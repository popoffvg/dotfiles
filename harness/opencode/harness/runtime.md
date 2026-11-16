# OpenCode runtime

Use OpenCode v2 tools for the shared workflows. Keep the selected model unless the user requests another model.

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

Claude hooks and Codex collaboration calls do not run in OpenCode. Follow the explicit lifecycle checks in `~/.config/opencode/harness/plugins/wm/codex-skills/wm/references/runtime.md`. Translate that guide's tools with the table above. Run ledger loops in the current session. Reload the route and notes after compaction.

Codex conversations remain in Codex. OpenCode starts new sessions with the shared rules, skills, commands, and agents. Connected ChatGPT plugins require separate OpenCode integrations; they do not transfer with authentication.
