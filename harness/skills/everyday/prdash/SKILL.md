---
name: prdash
description: Answer questions about the operator's GitHub PRs and tasks, and change their PR dashboard, with the prdash MCP tools (`prdash_list`, `prdash_show`, `prdash_run`). Use when the user asks about "my PRs", PR status, CI, review state, review comments, "what waits for me", a stack of PRs, the PRs related to a topic, repo, or branch, their folders, or their tasks — and to move a PR to a folder, make a folder, add or close a task, give an item to the agent, request a review, or open a PR. Use it instead of `gh pr list` and `gh pr view`.
---

# prdash

1. **Read the board.** Call `prdash_list`. Its first line is `me: <login> · synced: <time>`. If that time is more than 10 minutes ago, or the user asks for the current state, call `prdash_run` with `sync`, then `prdash_list` again.
2. **Select the rows the question is about.**
   - "What waits for me": the rows with WAIT above 0, and the rows with ROLE `reviewer` (a review the operator owes).
   - A topic, repo, or branch: a case-insensitive substring match on title, repo, branch, and folder. Tasks count.
   - "Related" PRs: add the chain of each matched PR. Follow STACKED ON down to the base and up to the last PR stacked on it. A PR on the same base outside the chain is not related.
3. **Call `prdash_show` for each selected PR with WAIT above 0 or CI `fail`.** It gives the last comment of each thread and the failed checks. The list holds the rest.
4. **Answer as a list, one PR per line:** `repo#123` with the title, CI, review state, and the threads that wait (the author and the last comment of each). Show a stack as one line from the base up: `main ← pl#2356 ← pl#2362`. Show a task as its ID and title. When no row matches after a fresh sync, say so.
5. **Change the board only when the user asks.** Run one command per `prdash_run` call. `mv` also moves the PRs stacked on the PR, so name every PR that moved.

When the MCP tools are not loaded, run the same commands in Bash: `prdash -as agent <command>`. `prdash -h` lists them.
