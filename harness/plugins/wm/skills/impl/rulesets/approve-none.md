## approve: none — nothing is shown before the report

- **5.1:** a new @implementer for each increment. **5.6** runs at each commit border.
- **5.2, 5.3, 5.4 do not run.**
- **After the last increment:** run the TODO review — `review:sub-todo.md` at speed `normal`, over `git diff <start>` (every commit of the TODO; `<start>` is the parent of commit 1), report target `TODO-N` — then go to step 6.
- **Step 8:** the green `review/TODO-N/report.md` of the TODO review is the PASS; the chain does not run a second time.
- **Step 9:** put the change table (`sub-impl.md` § Change table, start point form: `impl:ref-change-types.md` § The start point) in the report. It is the only place a human is told where the TODO changed the system.
