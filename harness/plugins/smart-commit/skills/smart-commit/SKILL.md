---
name: smart-commit
description: What makes a logical commit when splitting a working tree at hunk granularity, and the contract of the proposal file the operator answers. Read by the smart-commit agent in both phases — the propose phase writes against this format, the apply phase reads answers back out of it.
user-invocable: false
version: 0.1.0
---

# Splitting a working tree into commits

Two things live here: how to group hunks into commits, and the proposal file both phases share.
The procedure that uses them is the `smart-commit` agent; the patch mechanics are
`references/ref-patch-split.md`.

## What a logical commit is

A commit is one reason to change the code. The unit is the **hunk**, not the file — a file whose
one function gained a feature and whose other function lost a bug belongs in two commits.

Group hunks that share a reason:

- a feature, together with the tests that cover it
- one bug fix
- a refactor that changes no behaviour
- a config or dependency change
- documentation

Two signals that a group is wrong:

- **It needs "and" to describe it.** `feat: add health endpoint and fix shutdown` is two commits.
- **It cannot build alone.** A commit that adds a caller without its callee is not a unit. Hunks
  that only work together belong together, however different their reasons look.

Prefer fewer, honest commits over many thin ones. When a repo's whole diff really is one change,
propose one commit and say so in its Recommended line.

## Commit messages

Imperative mood, at most 72 characters, prefixed with a conventional type:

| Type | For |
| --- | --- |
| `feat` | new behaviour |
| `fix` | a bug corrected |
| `test` | tests added or updated |
| `doc` | README, comments, docs |
| `refactor` | restructuring with no behaviour change |
| `chore` | dependencies, config, maintenance |
| `perf` | a measured speed or memory win |
| `style` | formatting and lint only |

## The proposal file

`$TMPDIR/smart-commit/proposal.md`. One block per proposed commit, grouped under a heading per
repo, numbered from 1 within each repo.

Every block carries the four fields the operator needs to judge it without opening the diff:
**Source** (where to look), **Original** (which hunks), **Recommended** (the message and why those
hunks belong together), and an editable **Answer** slot.

Name hunks by the id the splitter's `list` mode assigned. Those ids are the join key between this
file and `plan.json` — if the operator edits one, the apply phase cannot resolve the block.

Show a compact chunk list only. No diff content, no code snippets: the operator is judging the
split, not reviewing the code.

````markdown
# Smart Commit Proposal

Edit the `**Answer:**` line of each block, then close the editor.

Answer values:
- `approve`        — commit as recommended
- `<new message>`  — commit these hunks, with this message instead
- `merge into <N>` — fold these hunks into commit N of the same repo
- `drop`           — leave these hunks uncommitted in the working tree

Do NOT change the hunk ids (`h3`, `h4`, ...) — the apply phase resolves blocks by them.

---

## /path/to/repo (branch: main)

### 1. feat: add k8s health check endpoint

- **Source:** `internal/server/server.go:120` · `internal/server/health.go:1`
- **Original:**
  - `h3` — `internal/server/server.go @@ -120,6 +120,25 @@` — register the health route
  - `h4` — `internal/server/health.go` (new file) — the handler
  - `h5` — `internal/server/health_test.go` (new file) — its tests
- **Recommended:** `feat: add k8s health check endpoint` — one feature with the tests that cover it

**Answer:** approve

---

### 2. fix: prevent nil pointer in graceful shutdown

- **Source:** `internal/server/server.go:45`
- **Original:**
  - `h2` — `internal/server/server.go @@ -45,8 +45,10 @@` — nil check before closing the listener
- **Recommended:** `fix: prevent nil pointer in graceful shutdown` — unrelated bug in the same file

**Answer:** approve

---
````

Repeat the `## <repo>` heading and its blocks for every repo with changes.
