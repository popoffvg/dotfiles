# Cases

## 2026-07-27 — Built the eval suite inside the skill directory

- **Repo:** `~/git/dotfiles`
- **Task:** Writing evals for the `capture-lesson` scope and form gates in the `self-improvement` plugin.
- **What I did:** Created `harness/plugins/self-improvement/skills/capture-lesson/evals/` — runner, cases, README — beside `SKILL.md`, and wired the skill to it with a relative path.
- **Correction:** > "and after show me evals result, evals should be placed in plugin folder"
- **Evidence:** Moved to `harness/plugins/self-improvement/evals/`; `run.sh` now resolves the graded spec as `$here/../skills/capture-lesson/SKILL.md` and the skill points at `${CLAUDE_PLUGIN_ROOT}/evals/`. Suite passed unchanged from the new location, so nothing but the paths depended on the old layout.
- **Ambiguous?** no — the skill dir holds what Claude loads; an eval grades from outside and serves the whole plugin.
- **Scope chosen:** project — the layout is this repo's `harness/plugins/<name>/` convention.
- **Rule written:** verdict — plugin evals live at the plugin root, one suite per plugin, runner reads the spec from the skill at run time.
