# OpenCode runtime

Use OpenCode v2 tools for the shared workflows. Resolve `{light}`, `{medium}`, and `{heavy}` through `~/.config/opencode/harness/effort-ledger.json`. The model selector includes its reasoning variant.

| Source instruction | OpenCode tool |
|---|---|
| Read, Glob, Grep | `read`, `glob`, `grep` |
| Bash | `shell` |
| Edit, Write, apply_patch | `edit` |
| Agent, Task, collaboration | `subagent` |
| AskUserQuestion | `question` |
| Skill | Read the named file from the harness skill index |

Use `/wm`, `/code`, `/review`, and `/dive` for the shared workflows. Public commands accept `$ARGUMENTS`. Internal workers live under `~/.config/opencode/harness/`.

Resolve `${CLAUDE_PLUGIN_ROOT}` against the selected plugin under `~/.config/opencode/harness/plugins/`. Use the named OpenCode subagent when a procedure requests an independent check. Await its report before the next dependent step.

The native `wm-hooks` plugin runs WM session, prompt, compaction, tool, and stop hooks. It translates tool inputs and block decisions through `harness/wm_hooks.py`. The WM manifest remains the hook roster. Read the explicit lifecycle checks in `~/.config/opencode/harness/plugins/wm/codex-skills/wm/references/runtime.md` only when the adapter is unavailable. Codex collaboration calls remain unavailable. Run ledger loops in the current session.

Codex conversations remain in Codex. OpenCode starts new sessions with the shared rules, skills, commands, and agents. Connected ChatGPT plugins require separate OpenCode integrations; they do not transfer with authentication.
