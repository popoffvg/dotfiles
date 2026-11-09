---
name: change-tour
description: Write one markdown file that teaches a reviewer a PR's context from zero — the problem, the terms, how the area worked, what the PR changes, where to look. Use for "tour this PR", "explain this PR so I can review it", "I don't know this area, walk me in", `/change-tour <PR> [part]`.
argument-hint: <PR url or number> [the part to explain, in words]
---

# change-tour — a PR's context, taught from zero

**Product.** One file, `$NOTES_DIR/research/pr-<n>.change-tour.md`, opened in the editor. `$NOTES_DIR` is the active wm notes dir, else `./.notes/`. A second run on the same PR overwrites it.

**Reader.** A reviewer who does not know the area the PR touches. They read the file once, top to bottom, then open the diff and can follow every hunk.

**Properties** — each tour MUST pass every one:

1. The sections come in this order: **Problem** · **Terms** · **How it worked** · **What changes** · **Where to look**.
2. **Problem** says what goes wrong without the PR, from the PR body, its linked issue, or its changeset. When none states it, the text derives it from the diff and ends with "(inferred)".
3. Each term is taught before its first use: no section uses a term a later section defines.
4. **How it worked** describes the touched area at the base: who calls it and what it does, in words or a call tree, with `path:line` at the base commit.
5. **What changes** draws the flow as a `show-me` call tree in a `diff` fence (`+` new, `-` removed, `~` changed), each node ending in `# path:line` at the head commit.
6. **Where to look** lists the hunks that need close reading, each with `path:line` and its reason: a trap, an asymmetry, a rejected alternative, or a changed contract.
7. Every fact traces to the PR body, the linked issue, the review comments, the diff, or the code; anything else is marked "(inferred)". No verdict and no list of changed files.
8. A hunk outside the PR's purpose, or outside the part the caller names, gets one line under **Where to look** and nothing more.

**Cause.** The old walk explained what changed, in call order, to a reader who did not yet know why the area exists or what its words mean, so it did not help them understand the PR. The `lessons` order — problem first, each term before its use — is the order the user rated good. One file, because one PR is small and the file opens beside the diff.

## Steps

1. **Collect the PR.** `gh pr view <n> --json number,title,body,baseRefName,headRefName,closingIssuesReferences` and `gh pr diff <n>`. Read the linked issue, the review comments (`gh pr view <n> --comments`), and the base side of each touched area and its callers. A `milaboratory/` repo that `gh` cannot resolve needs the work account: load `github-two-accounts`.
2. **Order and fill** by Steps 2 and 3 of the `lessons` skill: the term graph, then consequences, traps, rejected alternatives, and asymmetries.
3. **Write** the file, then open it with `~/.claude/scripts/open-file.sh <file>` and return its path.
