# Internal Claude workflows

These scripts are outside Claude's `workflows/` discovery directory. Reach them
through `/wm code auto`, `/wm code impl`, or `/review diff`.

| Route | Script beside this file | Arguments |
|---|---|---|
| `wm code auto` | `wm-code-auto.js` | `{ notesDir, deploy, maxGateFails }` |
| `wm code impl` | `wm-code-impl.js` | `{ todo, notesDir, risk, lessonsFile, maxGateFails }` |
| `review diff` | `wm-code-impl.js` | `{ mode: "diff", range, intent, notesDir }` |

Read the selected script and pass its absolute path as `scriptPath` to Claude's
`Workflow` tool, with `args` as a JSON object. Read the script's argument comments
for defaults; keep the current checkout as the working directory. Resolve old
`.claude/workflows/wm-code-*.js` references to these files. Follow the selected WM
route's gates and permission requirements.

Rulesync bundles the implementation body into the installed auto script. Its
per-TODO calls use a local async function, so no saved-name lookup or second public
registration is required. Both bodies retain the workflow runtime's agent, phase,
parallel, and pipeline primitives. This is Claude-specific orchestration; Codex and
Pi follow the WM runtime adapter and route steps.
