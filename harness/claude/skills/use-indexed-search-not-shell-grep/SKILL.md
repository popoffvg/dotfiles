---
name: use-indexed-search-not-shell-grep
description: Use when about to search file contents or locate files across a directory tree during a task — before running `grep -r`, `rg` over a dir, recursive `find`, `ls -R`, or piping a shell search into another command. Also when a task mixes remote shell work (`ssh`, a container, a path off the indexed tree) with local repo search, so the shell habit does not carry back. Route the search through the indexed search tools instead.
metadata:
  origin: self-improvement   # autocreated from a captured lesson
---

Run recursive searches through the indexed tools, not the shell.

| Need | Tool |
|---|---|
| File contents — a symbol, string, pattern | `mcp__fff__grep` |
| Which files exist for a topic / find a file by name | `mcp__fff__find_files` |
| 2+ identifiers or case variants in one pass | `mcp__fff__multi_grep` |

Applies to verification greps too — "check no mentions remain", "confirm every member was updated". Those are the ones that slip through as a quick `grep -r` at the end of a task.

Shell search stays legitimate only when the target is a single known file (`grep -n pattern path/to/one.md`) or the path is outside the indexed tree.

That exception does not carry over. A session that greps a remote host over `ssh` — or any path the index does not cover — must switch back to the indexed tools the moment the search target returns to the local repo. Remote shell grep is correct; the habit it leaves behind is not. Check where the path lives before each search, not once per session.

**Why:** the indexed tools are frecency-ranked and faster, and shell recursion re-walks the tree, drags in `.git/`, and needs manual excludes.
