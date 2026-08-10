---
name: repo-settings
description: Set up a repository's base documentation and Claude configuration — README.md, CLAUDE.md, a per-repo deploy skill, a per-repo adr skill, and .claude/settings.json. Use for "set up this repo", "add repo settings", "bootstrap README and CLAUDE.md", "add a deploy skill to this repo", "set up ADRs here".
disable-model-invocation: true
---

# repo-settings — bootstrap a repo's docs and Claude configuration

Produces six artifacts in the target repo:

| Artifact | Holds |
|---|---|
| `README.md` | What the repo is, how to run it, where to look next — for a human. |
| `.claude/skills/deploy/SKILL.md` | The deploy procedure for this repo. |
| `.claude/skills/adr/SKILL.md` | When and how to record a decision in `docs/adr/`, and how a superseded one moves to `docs/!archived/adr/`. |
| `.claude/hooks/adr-session-end.sh` | `SessionEnd` hook that asks for an ADR when a session decided something and recorded nothing. |
| `CLAUDE.md` | The maintenance contract — when Claude fires deploy, when Claude writes an ADR. |
| `.claude/settings.json` | Repo-scoped permissions, and the registration of the ADR reminder hook. |

Run the steps in order. Each artifact depends on facts the earlier steps collect.

## 1. Survey the repo

Collect the facts the artifacts need. Read, do not guess.

| Fact | Where to look |
|---|---|
| Purpose, one sentence | existing `README.md`, package manifest `description`, repo name |
| Language, runtime, versions | `go.mod`, `package.json`, `pyproject.toml`, `.tool-versions`, `mise.toml` |
| Build / test / lint commands | `Makefile`, `mise.toml`, `package.json` scripts, `justfile`, CI workflow steps |
| Deploy target and mechanism | `.github/workflows/`, `Dockerfile`, `helm/`, `k8s/`, `terraform/`, `fly.toml`, release scripts |
| Environments and their order | CI workflow `environment:` keys, branch protection, deploy script arguments |
| Existing Claude configuration | `CLAUDE.md`, `.claude/` |

**Completion criterion**: every row answered from a named file, or marked `unknown` for the user.

## 2. Confirm the gaps

Ask the user one batched question set covering only the rows marked `unknown` and the facts no file can state: rollback procedure, approval gates, who is on call, secrets source.

**Completion criterion**: no `unknown` row remains.

## 3. Write README.md

Follow `references/readme.md`.

**Completion criterion**: `README.md` has every required section, and every command in it was read from a real file in step 1.

## 4. Write the deploy skill

Follow `references/deploy-skill.md`.

**Completion criterion**: `.claude/skills/deploy/SKILL.md` exists, names each environment in promotion order, and states the rollback command.

## 5. Write the adr skill and its template

Follow `references/adr-skill.md`.

**Completion criterion**: `.claude/skills/adr/SKILL.md` exists and carries the full ADR format inline — metadata keys, template, numbering across `docs/adr/` and `docs/!archived/adr/`, and the archiving rule. The target repo reads nothing from outside itself.

## 6. Install the ADR reminder hook

Copy `~/.claude/scripts/adr-session-end-hook.sh` to `.claude/hooks/adr-session-end.sh` and `chmod +x` it. It runs on `SessionEnd`, greps the session transcript for decision-shaped language, and writes to stderr — `SessionEnd` cannot block and its stdout reaches nobody.

**The reminder is off by default.** Ask the user whether to turn it on for this repo, and create `.claude/adr-reminder.on` only if they say yes. Report both switches either way: the marker file turns it on for the repo, `ADR_REMINDER=on` for one run.

If the script is absent, say so and skip this step rather than writing a second copy of the logic inline.

**Completion criterion**: `.claude/hooks/adr-session-end.sh` is executable, and feeding it `{"cwd":"<repo>","transcript_path":"<a transcript naming a decision>"}` prints nothing until `.claude/adr-reminder.on` exists, then prints the reminder on stderr.

## 7. Write .claude/settings.json

Grant the repo's own commands. Take the command list from step 1 — build, test, lint, and the read-only half of deploy (status, diff, plan). Leave the applying half of deploy unpermitted, so it prompts.

Register the reminder hook in the same file:

```json
{
  "hooks": {
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/adr-session-end.sh", "timeout": 10 } ] }
    ]
  }
}
```

Consult the `update-config` skill for the settings.json schema and permission syntax.

**Completion criterion**: `.claude/settings.json` parses as JSON, each permission entry traces to a command found in step 1, and the `SessionEnd` entry points at the hook written in step 6.

## 8. Write CLAUDE.md

Follow `references/claude-md.md`. This is the maintenance contract, not a repeat of the README.

**Completion criterion**: `CLAUDE.md` states the trigger for the deploy skill, the trigger for the adr skill, and the rule that both stay current when the underlying mechanism changes.

## Revising an existing repo

An artifact that already exists gets **revised in place** — edit the sections that are wrong or missing, keep the rest. Report which sections changed. Overwriting a hand-written README or CLAUDE.md loses knowledge no file states.
