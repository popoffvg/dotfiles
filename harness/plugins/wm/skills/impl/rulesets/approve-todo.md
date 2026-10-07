## approve: todo — the human reads the whole TODO once

- **Implementer:** start one @implementer for the whole TODO and reuse it. Start it for the first increment with `name: impl-TODO-N`, then send each later increment to that same agent with `SendMessage`. It keeps the pre-reads and the code of the increments before, so it does not read them again. Start a new one only when that agent is gone, and give it the `TODO-N.agent.md` `## Gotchas`.
- **5.2, 5.3, 5.4 do not run per increment.**
- **After the last increment, before step 6:** run the TODO review — `review:sub-todo.md` at speed `normal`, over `git diff HEAD~1` (the whole commit), report target `TODO-N`. Then show the change table (`sub-impl.md` § Change table) — start point, main changes, one row counting the rest (`impl:ref-change-types.md` § The start point) — then one `git diff` of the whole TODO next to the **Blast radius** of every increment in it, and wait once. Name the gate rounds the TODO review spent.
- **Rejected:** name the increment the user rejects, set `status: blocked`, and stop. The commit stays as it is until `revise` or a fixup settles it.
- **Step 8:** the green `review/TODO-N/report.md` of the TODO review is the PASS; the chain does not run a second time.
- **Step 9:** put the same change table in the report.
