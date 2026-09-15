---
name: sandbox-write-follows-symlinks
description: Use when a Bash write inside a project directory fails with "Operation not permitted" / EPERM — a shell redirect, tee, or mkdir into a path you believe is inside the repo. The sandbox checks the resolved real path, so a directory that is a symlink out of the project (.notes, a cache, a store) is judged by its target, not by where it sits.
metadata:
  origin: self-improvement
---

**The sandbox judges the real path, not the path you typed.** A directory inside the repo can be a
symlink whose target lives somewhere else, so a write that looks local is a write outside the
project and the sandbox denies it.

## Do

1. **Resolve the path before anything else.**
   ```bash
   ls -ld <path>
   python3 -c "import os;print(os.path.realpath('<path>'))"
   ```
   A symlink that leaves the project is the cause. The write was never inside the repo.

2. **Add the real target to `sandbox.filesystem.allowWrite`** in `harness/claude/settings.json`
   (stowed to `~/.claude/settings.json`). Add the store **root** — `~/.notes` — not the single leaf
   path that failed, or the next project hits the same denial.

3. **Say that it takes effect in new sessions only.** The running session keeps the sandbox profile
   it started with, so a retry now fails the same way.

4. **Check whether the file already exists before calling the work lost.** The Write tool is not
   sandboxed the same way as a shell redirect. A subagent that hit EPERM on `>` may have written the
   file with Write — read its size and mtime first.

5. **Name the entry you added, and why, in the same answer as the diagnosis.** Widening the
   allowlist changes global settings, so the user must see which path you opened.
