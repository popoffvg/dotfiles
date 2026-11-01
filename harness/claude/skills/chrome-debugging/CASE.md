## 2026-10-29 — Preserve the approved Chrome connection

- **Repo:** `/Users/popoffvg/Documents/git/dotfiles`; browser targets were Amp and Todoist.
- **Source:** correction.
- **Task:** Create a Todoist project and connect it to the miniauth Amp project.
- **What I did:** Started and terminated a separate Chrome MCP subprocess for each browser action, causing repeated browser approval prompts.
- **User's words:** > you always ask my approval in chrome, don't break connection
- **Evidence:** A single long-lived MCP subprocess behind a mode-600 local Unix socket subsequently performed the remaining browser actions without per-action reconnection. The real Todoist event produced one worker and one result comment.
- **Ambiguous?** No for the active multi-action browser task; reconnect remains appropriate after a real connection failure or an explicit user request.
- **Scope chosen:** Global; authenticated browser workflows recur across projects.
- **Rule written:** Keep one approved browser transport alive throughout the task, including shell-based fallback calls.
- **Transcript:** Current session; no archive path available.
- **Session topic:** Local Chrome control and Todoist-to-Amp webhook setup.
