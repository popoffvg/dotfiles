## approve: todo — the human reads the whole TODO once

- **5.1:** one @implementer applies every increment, one by one in `## Increments` order. Its prompt names the first increment to apply: the one after the last `**Landed:** yes`. It reads each increment's **Files** and **Pre-reads** only when it reaches that increment. It runs 5.5 for each increment, and 5.6 at each commit border, before it starts the next one, so a stop leaves a correct resume point. A replan stops the run at that increment; the session handles it at step 4.
- **5.2, 5.3, 5.4 do not run per increment.**
- **After the last increment, before step 6:** run the TODO review — `review:sub-todo.md` at speed `normal`, over `git diff <start>` (every commit of the TODO; `<start>` is the parent of commit 1), report target `TODO-N`. Then show the change table (`sub-impl.md` § Change table) — start point, main changes, one row counting the rest (`impl:ref-change-types.md` § The start point) — then one `git diff <start>` of the whole TODO, commit by commit, next to the **Surprises** of every increment in it, and wait once. Name the gate rounds the TODO review spent.
- **Rejected:** name the increment the user rejects, set `status: blocked`, and stop. The commits stay as they are until `revise` or a fixup settles it.
- **Step 8:** the green `review/TODO-N/report.md` of the TODO review is the PASS; the chain does not run a second time.
- **Step 9:** put the same change table in the report.
