---
name: diff-walk
description: "Write a markdown walk-through of a diff for a fast review: an overview that restores the context, the meaning of the main types, then a call tree and a walk in call order with a `path:line` at each step. Use for \"walk me through this diff\", \"explain this change for review\", `/diff-walk` with a revision, a range, a PR, or nothing (the uncommitted change), and on every `zed-diff` run."
argument-hint: "[nothing | BASE | COMMIT^! | A..B | A...B | last | PR] [dst:DIR] [-- PATH...]"
model: sonnet
agent: general-purpose
---

# Diff walk

**Structure first, details last.** Each section of the walk adds detail to the one before: Overview → Main types → Flow → Walk, and the walk goes in call order, never in file order. A reader who stops after any section has the whole change at that level of detail, and never keeps a fact in mind that a later section explains.

The walk explains the change and gives no verdict: no PASS/FAIL, no edit to source, no commit. Write it yourself, in one pass, as one view of the whole flow.

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

   Read an untracked file as one all-added hunk.
2. **Name the file** `$NOTES_DIR/research/<slug>.diff-walk.md`. `$NOTES_DIR` is the active wm notes dir, else `./.notes/`. A `dst:<dir>` argument replaces `$NOTES_DIR/research`. A second run on the same target overwrites the file.
3. **Find the flows.** List every hunk. Read the code around each hunk, find the entry point that the change touches (for a markdown-only change, the command or skill the operator invokes), and follow the call path down. A diff that holds unrelated changes has one flow per change. A hunk with no call path (docs, config, tests) goes in "Off the flow". Done when every hunk on the list has a place.
4. **Collect the context.** Read the base side of each entry point and its callers for **Context**, and the definition of each type a step reads for **Main types**. Done when every type a walk step will name has its definition read.
5. **Write the file** in the order of the template below. Done when each hunk on the step 3 list appears exactly once — in a walk step or in "Off the flow" — and every tree node is a walk step.
6. **Open the file** with `~/.claude/scripts/open-file.sh <file>` and return its path.

## Template

````markdown
# <slug> — <one-line title>

## Look here first
At most 5 risks, most risk first: a changed contract or signature, an error path, a concurrency or state change. Each is `path:line` and one sentence that says what to check — a risk, not a verdict.

## Overview
**Intent.** 1–3 sentences from the commit messages or the PR body. For uncommitted changes, or when neither states one, derive it from the diff and end it with "(inferred)".

**Context.** 2–4 sentences for a reader who has not seen this code for weeks: what the touched area does at the base, who calls it, and what gap or problem the change answers. Name the area by its entry point and its main types, not by its files.

## Main types
| Type | Kind | Meaning | Change |
|------|------|---------|--------|
| `pkg/auth.Session` | struct | One login of a user; moves active → rotated → revoked | adds the `rotated` state |
| `pkg/auth.TokenPair` | struct | An access token plus the refresh token that renews it | new |

One row per type a walk step names in backticks, main types first. **Meaning** is what the type stands for in the domain, at the tip, in one sentence. **Change** is `new`, `removed`, `unchanged`, or what changed in one phrase. A diff with no code types lists its terms the same way: a skill, a command, an agent, a config key.

## Flow

```diff
# under <common root>
  <entry point>                                   # <path:line>
~ ├── <changed callee>                            # <path:line>
+ │   └── <new callee>                            # <path:line>
- └── <removed callee>                            # <path:line @ base sha>
```

The call tree of the change, in the `show-me` call-tree form: `+` new (absent at the base), `-` removed, `~` changed, a space for unchanged context. One tree per flow. Draw only the nodes of the change and the callers that connect them; each node is a symbol a walk step names. Three levels: the entry point, its callee, and that callee's callee — a deeper call is named in the walk step of its third-level node. A flow with no code calls (commands, skills) uses the same tree, with "loads" in place of "calls".

## Walk
One numbered walk per flow, under `### <flow name>` when there is more than one.

### 1. `<symbol>` — `path:line`
**For:** what this step does for the flow — the later step or the result that needs it.
One or two sentences: what changed and why it matters to the flow.
```diff
<short excerpt from the hunk>
```

### N. Off the flow
One line per hunk that is not on the call path.
````

Cite every `path:line` at the tip side of the diff (the working tree for uncommitted changes). A removed symbol has no tip line: cite it as `path:line @ <base short sha>`.
