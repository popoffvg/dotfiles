## approve: increment — the human reads each increment

- **Implementer:** start a new @implementer for each increment. Each diff the human reads comes from a clean context.
- **5.2 runs:** the increment review — `review:sub-todo.md` at speed `fast`, over `git add -N .` then `git diff HEAD` (the increment's diff exists only between 5.1 and the amend in 5.5), report target `TODO-N/inc-<k>`, `<k>` = the increment's number in `## Increments`.
- **5.3 runs:** show the real `git diff` of what landed next to the increment's predicted **Blast radius**, and above it the change table (`sub-impl.md` § Change table). Say when the increment has no `new behavior` and no `signature change` row — it is mechanical, and the approval is one glance. Say when the real diff exceeds the predicted radius — that is the signal the plan is wrong. Name the gate rounds 5.2 spent, so the human knows the diff they read is the fixed one.
- **5.4 runs:** wait for approval. Approved → continue. Rejected → stop, report which increment was rejected and why, set `status: blocked`; apply nothing after it.
- Never batch two increments into one approval.
- **Step 8:** `done` is set by the `review:sub-todo.md` chain on PASS; FAIL → `blocked`.
