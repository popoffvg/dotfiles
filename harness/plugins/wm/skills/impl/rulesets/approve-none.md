## approve: none — nothing is shown before the report

- **Implementer:** start one @implementer for the whole TODO and reuse it. Start it for the first increment with `name: impl-TODO-N`, then send each later increment to that same agent with `SendMessage`. It keeps the pre-reads and the code of the increments before, so it does not read them again. Start a new one only when that agent is gone, and give it the `TODO-N.agent.md` `## Gotchas`.
- **5.2, 5.3, 5.4 do not run.**
- **After the last increment:** run the TODO review — `review:sub-todo.md` at speed `normal`, over `git diff HEAD~1` (the whole commit), report target `TODO-N` — then go to step 6.
- **Step 8:** the green `review/TODO-N/report.md` of the TODO review is the PASS; the chain does not run a second time.
- **Step 9:** put the change table (`sub-impl.md` § Change table, start point form: `impl:ref-change-types.md` § The start point) in the report. It is the only place a human is told where the TODO changed the system.
