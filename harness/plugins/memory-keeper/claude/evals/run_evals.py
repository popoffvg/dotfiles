#!/usr/bin/env python3
"""
Eval runner for memory-keeper plugin skills.

Three eval modes:
  1. trigger   — Does the right skill activate for a given prompt?
  2. output    — Does the skill produce expected files/content?
  3. e2e       — Full flow: prompt → skill → saved artifact

Uses Claude API (Haiku) as an LLM judge for trigger classification.
"""

import json
import os
import subprocess
import sys
import tempfile
import shutil
from datetime import datetime
from pathlib import Path

PLUGIN_ROOT = Path(__file__).parent.parent
EVALS_DIR = Path(__file__).parent
SKILLS_DIR = PLUGIN_ROOT / "skills"
CONFIG_PATH = Path.home() / ".claude" / "memory-keeper.local.md"
DEFAULT_INSIGHTS_ROOT = Path.home() / "ctx" / "insights"

SKILLS = ["context-save", "context-find", "context-check", "context-research"]


def load_test_cases(path: Path = None) -> list[dict]:
    path = path or EVALS_DIR / "test_cases.json"
    with open(path) as f:
        data = json.load(f)
    return data["cases"]


def load_skill_descriptions() -> dict[str, str]:
    """Load name + description from each SKILL.md frontmatter."""
    descriptions = {}
    for skill_name in SKILLS:
        skill_md = SKILLS_DIR / skill_name / "SKILL.md"
        if not skill_md.exists():
            continue
        text = skill_md.read_text()
        in_frontmatter = False
        desc = ""
        for line in text.splitlines():
            if line.strip() == "---":
                if in_frontmatter:
                    break
                in_frontmatter = True
                continue
            if in_frontmatter and line.startswith("description:"):
                desc = line[len("description:"):].strip()
        descriptions[skill_name] = desc
    return descriptions


def ask_llm_judge(prompt: str, skill_descriptions: dict[str, str]) -> dict:
    """Use Haiku to classify which skill a prompt should trigger."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"error": "ANTHROPIC_API_KEY not set"}

    skills_text = "\n".join(
        f"- **{name}**: {desc}" for name, desc in skill_descriptions.items()
    )

    judge_prompt = f"""Classify the following user prompt into one of these skills, or null if none should trigger.

Available skills:
{skills_text}

User prompt: "{prompt}"

IMPORTANT rules:
- If "research", "context", "save", "recall" appear as part of a repo name, URL, hostname, file path, or code identifier — return null.
- If the user is discussing a feature/skill definition (not invoking it) — return null.
- If the user is debugging or asking about skill behavior — return null.
- Only return a skill name if the user clearly intends to invoke the skill's action.

Return ONLY valid JSON: {{"skill": "<skill-name-or-null>", "confidence": <0.0-1.0>, "reason": "<short reason>"}}"""

    try:
        result = subprocess.run(
            [
                "curl", "-s", "-X", "POST",
                "https://api.anthropic.com/v1/messages",
                "-H", f"x-api-key: {api_key}",
                "-H", "anthropic-version: 2023-06-01",
                "-H", "content-type: application/json",
                "-d", json.dumps({
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 200,
                    "messages": [{"role": "user", "content": judge_prompt}]
                })
            ],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            return {"error": f"curl failed: {result.stderr}"}

        response = json.loads(result.stdout)
        if "error" in response:
            return {"error": str(response["error"])}

        text = response.get("content", [{}])[0].get("text", "").strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
        if text.endswith("```"):
            text = "\n".join(text.split("\n")[:-1])

        return json.loads(text.strip())
    except Exception as e:
        return {"error": str(e)}


def run_trigger_eval(cases: list[dict], skill_descriptions: dict[str, str]) -> list[dict]:
    """Eval 1: Trigger accuracy — does the right skill activate?"""
    results = []
    for case in cases:
        judge = ask_llm_judge(case["prompt"], skill_descriptions)
        predicted = judge.get("skill")
        if predicted == "null":
            predicted = None
        expected = case["expected_skill"]
        passed = predicted == expected

        results.append({
            "id": case["id"],
            "type": case["type"],
            "prompt": case["prompt"],
            "expected": expected,
            "predicted": predicted,
            "confidence": judge.get("confidence"),
            "reason": judge.get("reason", ""),
            "passed": passed,
            "error": judge.get("error"),
        })
    return results


def run_output_eval(cases: list[dict]) -> list[dict]:
    """Eval 2: Output correctness — do save operations produce valid files?

    Tests the save functions from stop-insight-extractor.py directly.
    """
    results = []
    save_cases = [c for c in cases if c["expected_skill"] == "context-save"]
    if not save_cases:
        return results

    tmpdir = tempfile.mkdtemp(prefix="mk-eval-")
    try:
        # Import save functions (hyphenated filename requires importlib)
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "extractor", str(PLUGIN_ROOT / "hooks" / "stop-insight-extractor.py")
        )
        extractor = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(extractor)

        # Patch insights root to tmpdir
        original_expanduser = os.path.expanduser
        def mock_expanduser(path):
            if "~/ctx/insights" in path:
                return path.replace(
                    original_expanduser("~/ctx/insights"), tmpdir
                )
            return original_expanduser(path)

        os.path.expanduser = mock_expanduser
        try:
            # Test insight save
            path = extractor.save_insight(
                insight="Test insight content",
                topic="test-topic",
                project="test-project",
                cwd="/tmp/test",
                rationale="Test rationale",
                workflow="testing",
            )
            insight_ok = os.path.exists(path)
            if insight_ok:
                content = open(path).read()
                insight_ok = (
                    "## test-topic" in content
                    and "Test insight content" in content
                    and "Test rationale" in content
                )
            results.append({
                "id": "output-insight",
                "test": "save_insight produces valid markdown",
                "passed": insight_ok,
                "path": path,
            })

            # Test task save
            path = extractor.save_task(
                title="Test Task",
                description="A test task",
                project="test-project",
                cwd="/tmp/test",
                rationale="Test rationale",
                workflow="testing",
            )
            task_ok = os.path.exists(path)
            if task_ok:
                content = open(path).read()
                task_ok = (
                    "## Test Task" in content
                    and "A test task" in content
                )
            results.append({
                "id": "output-task",
                "test": "save_task produces valid markdown",
                "passed": task_ok,
                "path": path,
            })

            # Test agent_edit save
            path = extractor.save_agent_edit(
                insight="Test correction",
                topic="test-behavior",
                cwd="/tmp/test",
                improvement="Always do X",
                rationale="Test rationale",
                workflow="testing",
            )
            edit_ok = os.path.exists(path)
            if edit_ok:
                content = open(path).read()
                edit_ok = (
                    "## test-behavior" in content
                    and "Always do X" in content
                )
            results.append({
                "id": "output-agent-edit",
                "test": "save_agent_edit produces valid markdown",
                "passed": edit_ok,
                "path": path,
            })
        finally:
            os.path.expanduser = original_expanduser
    except Exception as e:
        results.append({
            "id": "output-error",
            "test": "output eval setup",
            "passed": False,
            "error": str(e),
        })
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
        pass  # cleanup handled by tmpdir removal

    return results


def run_e2e_eval() -> list[dict]:
    """Eval 3: End-to-end — session-start.sh produces valid JSON output."""
    results = []

    tmpdir = tempfile.mkdtemp(prefix="mk-eval-e2e-")
    try:
        # Create a fake project with _summary.md
        project_dir = os.path.join(tmpdir, "test-project")
        os.makedirs(project_dir)
        with open(os.path.join(project_dir, "_summary.md"), "w") as f:
            f.write("# Test Project\nThis is a test summary.")

        session_start = PLUGIN_ROOT / "hooks" / "session-start.sh"

        # Test 1: Matching cwd injects context
        input_json = json.dumps({"cwd": "/some/path/test-project/src"})
        env = os.environ.copy()
        env["HOME"] = tmpdir  # so ~/ctx/insights/ → tmpdir/ctx/insights/
        # Symlink to make the path work
        ctx_path = os.path.join(tmpdir, "ctx", "insights")
        os.makedirs(os.path.dirname(ctx_path), exist_ok=True)
        os.symlink(tmpdir, ctx_path)

        result = subprocess.run(
            ["bash", str(session_start)],
            input=input_json,
            capture_output=True, text=True, timeout=5,
            env=env,
        )
        if result.returncode == 0 and result.stdout.strip():
            try:
                output = json.loads(result.stdout)
                has_context = "additionalContext" in output.get("hookSpecificOutput", {})
                results.append({
                    "id": "e2e-session-start-match",
                    "test": "session-start injects context for matching cwd",
                    "passed": has_context,
                    "output_keys": list(output.get("hookSpecificOutput", {}).keys()),
                })
            except json.JSONDecodeError:
                results.append({
                    "id": "e2e-session-start-match",
                    "test": "session-start produces valid JSON",
                    "passed": False,
                    "error": f"Invalid JSON: {result.stdout[:200]}",
                })
        else:
            results.append({
                "id": "e2e-session-start-match",
                "test": "session-start injects context for matching cwd",
                "passed": False,
                "error": result.stderr[:200] if result.stderr else "no output",
            })

        # Test 2: Non-matching cwd produces no output
        input_json = json.dumps({"cwd": "/some/other/path"})
        result = subprocess.run(
            ["bash", str(session_start)],
            input=input_json,
            capture_output=True, text=True, timeout=5,
            env=env,
        )
        no_output = result.returncode == 0 and not result.stdout.strip()
        results.append({
            "id": "e2e-session-start-nomatch",
            "test": "session-start produces no output for non-matching cwd",
            "passed": no_output,
        })

    except Exception as e:
        results.append({
            "id": "e2e-error",
            "test": "e2e eval setup",
            "passed": False,
            "error": str(e),
        })
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    return results


def print_report(trigger_results: list, output_results: list, e2e_results: list):
    """Print a summary report."""
    all_results = trigger_results + output_results + e2e_results
    passed = sum(1 for r in all_results if r.get("passed"))
    failed = sum(1 for r in all_results if not r.get("passed"))
    total = len(all_results)

    print(f"\n{'='*60}")
    print(f"  memory-keeper eval results — {datetime.now():%Y-%m-%d %H:%M}")
    print(f"{'='*60}")

    # Trigger results
    if trigger_results:
        print(f"\n## Trigger Accuracy ({len(trigger_results)} cases)")
        tp = sum(1 for r in trigger_results if r["passed"])
        print(f"   Pass: {tp}/{len(trigger_results)} ({100*tp/len(trigger_results):.0f}%)")
        for r in trigger_results:
            status = "PASS" if r["passed"] else "FAIL"
            err = f" ERROR: {r['error']}" if r.get("error") else ""
            if not r["passed"]:
                print(f"   [{status}] {r['id']}: expected={r['expected']}, got={r['predicted']} — {r['prompt'][:60]}{err}")

    # Output results
    if output_results:
        print(f"\n## Output Correctness ({len(output_results)} cases)")
        for r in output_results:
            status = "PASS" if r["passed"] else "FAIL"
            err = f" — {r.get('error', '')}" if r.get("error") else ""
            print(f"   [{status}] {r['id']}: {r['test']}{err}")

    # E2E results
    if e2e_results:
        print(f"\n## End-to-End ({len(e2e_results)} cases)")
        for r in e2e_results:
            status = "PASS" if r["passed"] else "FAIL"
            err = f" — {r.get('error', '')}" if r.get("error") else ""
            print(f"   [{status}] {r['id']}: {r['test']}{err}")

    print(f"\n{'='*60}")
    print(f"  TOTAL: {passed}/{total} passed, {failed} failed")
    print(f"{'='*60}\n")

    return failed == 0


def main():
    import argparse
    parser = argparse.ArgumentParser(description="memory-keeper eval runner")
    parser.add_argument("--mode", choices=["trigger", "output", "e2e", "all"], default="all")
    parser.add_argument("--cases", type=Path, help="Path to test_cases.json")
    parser.add_argument("--filter", type=str, help="Filter cases by id prefix (e.g. 'save-', 'neg-')")
    args = parser.parse_args()

    cases = load_test_cases(args.cases)
    if args.filter:
        cases = [c for c in cases if c["id"].startswith(args.filter)]

    trigger_results = []
    output_results = []
    e2e_results = []

    if args.mode in ("trigger", "all"):
        print("Running trigger evals...")
        descriptions = load_skill_descriptions()
        trigger_results = run_trigger_eval(cases, descriptions)

    if args.mode in ("output", "all"):
        print("Running output evals...")
        output_results = run_output_eval(cases)

    if args.mode in ("e2e", "all"):
        print("Running e2e evals...")
        e2e_results = run_e2e_eval()

    success = print_report(trigger_results, output_results, e2e_results)

    # Save results
    results_path = EVALS_DIR / "results.json"
    with open(results_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "trigger": trigger_results,
            "output": output_results,
            "e2e": e2e_results,
        }, f, indent=2)
    print(f"Full results saved to {results_path}")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
