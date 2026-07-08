---
name: prx
description: This skill should be used when the user runs "/prx", "/prx <pr-url>", or "/prx post" — to collect the user's review comments against a diff and post them as an inline GitHub PR review. Trigger on "collect my PR comments", "start collecting comments", "post my comments to the PR", "send the review comments".
version: 0.1.0
---

# prx — collect diff comments, post as a PR review

Collect the user's review comments against a diff over one or more turns, then post them all as a single inline GitHub PR review.

State lives in one file: `~/.claude/prx/comments.md`. One active collection at a time. `/prx` (start) resets it; `/prx post` reads it, posts, then clears it.

## Subcommands

Parse the argument after `/prx`:

| Argument | Action |
|---|---|
| *(empty)* | **start** — begin/resume collecting comments |
| a URL (`https://github.com/.../pull/N`) | **start + remember** — same as start, store the PR URL |
| `post` | **post** — submit collected comments as a PR review |

### start (`/prx` or `/prx <url>`)

1. Ensure `~/.claude/prx/` exists.
2. If a URL was given, or the file has no `PR:` line, write/overwrite the header:
   ```
   PR: <url or "(unset)">

   ```
   A bare `/prx` with an existing file **keeps** accumulated comments (resume). A `/prx <url>` updates the `PR:` line without dropping comments.
3. Show the diff to review:
   - PR URL known → `gh pr diff <url>` (org repos: see `references/posting.md` for auth).
   - else → `git diff` (working tree) — confirm with the user which diff they mean if ambiguous.
4. Tell the user: give comments referencing `file:line`, e.g. *"foo.go:42 — this leaks the handle"*. Then run `/prx post` when done.

### collect (during conversation, after start)

Each time the user gives a review comment, append one line to `~/.claude/prx/comments.md`:

```
- <path>:<line> [<SIDE>] — <body>
```

- `<path>` — repo-relative file path, exactly as it appears in the diff.
- `<line>` — line number in the **new** file (RIGHT side). For a comment on a deleted line, use the old line number and mark `[LEFT]`.
- `[<SIDE>]` — optional, default `RIGHT`; only write `[LEFT]` for removed-line comments.
- `<body>` — the comment text.

A comment with no clear line (a file-level or PR-level note) → append as `- <path> — <body>` (no line) or `- (general) — <body>`.

Confirm each append briefly (one line). Do not post yet.

### post (`/prx post`)

1. Read `~/.claude/prx/comments.md`. If no comments → tell the user, stop.
2. Resolve the PR: use the `PR:` line. If unset/`(unset)` → **ask the user for the PR URL** before doing anything else.
3. Post all comments as **one inline review**. Use the GitHub MCP review flow (create pending review → add each comment → submit). Full mechanics, the head-SHA step, LEFT/RIGHT/general handling, org-repo auth, and the `gh` CLI fallback are in `references/posting.md`.
4. Report: review URL, count posted, and any comments that fell back to general (line not in diff).
5. On success, clear the file (reset to an empty header) so the next `/prx` starts fresh.

## Notes

- Inline comments only attach to lines **present in the PR diff**. A `file:line` outside the diff → post it as a general review comment and say so in the report.
- Keep the review as a single submission, not one comment per API call visible separately — batch via the pending review.

## Additional Resources

- **`references/posting.md`** — GitHub review API mechanics, head-SHA lookup, MCP vs `gh` CLI, milaboratory org auth switch, error fallbacks.
