---
name: diff-walk
description: "Write a markdown walk-through of a diff for a fast review, in call order, with a call tree of the change and a `path:line` at each step. Use for \"walk me through this diff\", \"explain this change for review\", `/diff-walk` with a revision, a range, a PR, or nothing (the uncommitted change), and on every `zed-diff` run."
argument-hint: "[nothing | BASE | COMMIT^! | A..B | A...B | last | PR] [-- PATH...]"
context: fork
agent: general-purpose
---

# Diff walk

The walk explains the change and rules on nothing. It gives no PASS/FAIL: judging the change is the job of a review. Source stays read-only: the walk writes only its own file and never commits.

The skill runs in a fork, so reading the diff stays out of the caller's context. Inside the fork, spawn no subagents: one diff is small enough for one reader, and the walk needs one view of the whole flow.

## Steps

1. **Resolve the target into one revision range.** The arguments use `git diff` syntax, so `zed-diff` passes its own arguments unchanged. Say what you resolved. An empty range stops the run and reports `empty`; it never writes a file.

   | The caller said | The range | Slug |
   |---|---|---|
   | nothing | `HEAD` against the working tree: staged, unstaged, and untracked files | `wip-<HEAD short sha>` |
   | `BASE` | `BASE` against the working tree, untracked files included | `<BASE short sha>-wip` |
   | `last` | `HEAD~1..HEAD` | the short sha of `HEAD` |
   | `COMMIT^!` | that one commit | the short sha of `COMMIT` |
   | `A..B` | exactly that | `<A short sha>-<B short sha>` |
   | `A...B` | `<merge base of A and B>..B` — a branch against its base | `<B name, each / replaced by ->` |
   | a PR url or number | `<base>..<head>` of the PR, after `gh pr checkout` or a fetch of both | `pr-<n>` |
   | `-- PATH...` after any of these | the same range, only these paths | the same slug |

   Read an untracked file as one all-added hunk; it is often a new node of the flow.
2. **Name the file** `$NOTES_DIR/research/<slug>.diff-walk.md`. `$NOTES_DIR` is the active wm notes dir, else `./.notes/`. A `dst:<dir>` argument replaces `$NOTES_DIR/research`. A second run on the same target overwrites the file.
3. **Find the flows.** List every hunk. Read the diff and the code around each hunk, find the entry point that the change touches, and follow the call path down. A diff that holds unrelated changes has one flow per change. A hunk with no call path (docs, config, tests) goes in "Off the flow". Done when every hunk on the list has a place. Then write the file in the order of the template below.
4. **Open the file** with `~/.claude/scripts/open-file.sh <file>` and return its path.

## Template

````markdown
# <slug> — <one-line title>

**Intent.** 1–3 sentences from the commit messages or the PR body. For uncommitted changes, or when neither states one, derive it from the diff and end it with "(inferred)".

| File | + | − |
|---|---|---|

## Flow

```diff
# under <common root>
  <entry point>                                   # <path:line>
~ ├── <changed callee>                            # <path:line>
+ │   └── <new callee>                            # <path:line>
- └── <removed callee>                            # <path:line @ base sha>
```

The call tree of the change, in the `show-me` call-tree form under a `diff` fence: `+` new (absent at the base), `-` removed, `~` changed, a space for unchanged context.

## Walk
One numbered walk per flow, under `### <flow name>` when there is more than one, each with its own tree under `## Flow`.

### 1. `<symbol>` — `path:line`
One or two sentences: what changed and why it matters to the flow.
```diff
<short excerpt from the hunk>
```

### N. Off the flow
One line per hunk that is not on the call path.

## Look here first
At most 5 items, most risk first. Each is `path:line` and one sentence.
````

## Rules for the content

- **Walk in call order, never in file order.** The reader follows the flow; a file order makes them rebuild it.
- **Cite each step at the tip side of the diff** (the working tree for uncommitted changes). A removed symbol has no tip line, so cite it as `path:line @ <base short sha>`.
- **Every changed hunk appears exactly once**, in a walk step or in "Off the flow".
- **Each tree node is a symbol the walk names**, so the reader can go from the tree to the step. Draw only the nodes of the change and the callers that connect them (`show-me` § Three rules: cut to the question). A flow with no code calls (commands, skills) uses the same tree, with "loads" in place of "calls".
- **"Look here first" lists risk, not verdicts:** a changed contract or signature, an error path, a concurrency or state change. Point at the hunk and say what to check.

## Done when

The file is open at the resolved path, each hunk on the step 3 list appears exactly once in the file, every rule above holds, and every tree node is a step of the walk.
