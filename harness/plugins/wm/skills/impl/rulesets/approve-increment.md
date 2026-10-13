## approve: increment — the human reads each increment

- **5.1:** a new @implementer for each increment. **5.6** runs at each commit border.
- **5.2 runs:** the increment review — `review:sub-todo.md` at speed `fast`, over `git add -N .` then `git diff HEAD` (the increment's diff exists only between 5.1 and the commit or amend in 5.5), report target `TODO-N/inc-<c>.<i>`, `<c>.<i>` = the increment's number in `## Increments`.
- **5.3 runs:** show the real `git diff` of what landed next to the increment's **Surprises**, and above it the change table (`sub-impl.md` § Change table). Say when the increment has no `new behavior` and no `signature change` row — it is mechanical, and the approval is one glance. Say when the real diff changes a component the increment does not name — that is the signal the plan is wrong. Name the gate rounds 5.2 spent, so the human knows the diff they read is the fixed one.
- **5.4 runs:** wait for approval. Approved → continue. Rejected → stop, report which increment was rejected and why, set `status: blocked`; apply nothing after it.
- Never batch two increments into one approval, except a signature change and the migration increment that follows it (`sub-impl.md` step 5).
- **Step 8:** `done` is set by the `review:sub-todo.md` chain on PASS; FAIL → `blocked`.
