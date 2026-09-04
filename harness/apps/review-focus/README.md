# review-focus

A Hunk extension that orders a review by what is worth reading.

Three signals, in this order:

1. **Marked files** — an agent (or you) marks a file with `hunk focus add`, optionally with a reason. Marked files sort to the top, in mark order, and appear in a **Start here** pane with their reason.
2. **Test files** — matched by path, sorted below everything unmarked.
3. **Generated protobuf output** — `*.pb.go`, `*_pb2.py`, `*.pb.ts`, and friends, sorted last.

Marking a file beats both demotions: a `.pb.go` file you marked reads first.

Separately, `review-focus` tracks which hunks and files you've actually reviewed (`m`/`space`
below) — that state doesn't reorder anything, it just shows progress.

## CLI

```bash
hunk focus add src/auth/session.rs --why "token minting moved before identity bind"
hunk focus add src/cli/root.rs
hunk focus list
hunk focus rm src/cli/root.rs
hunk focus clear --yes
```

Marks are per repository root, stored outside the repo in
`${XDG_STATE_HOME:-~/.local/state}/review-focus/marks.json`, so a throwaway worktree
never carries them into a diff.

Marks are read when a review loads. To apply new marks to a window that is already open:

```bash
hunk session reload --repo .
```

## Keys

| Key      | Command                | Does                                                                              |
| -------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `i`      | `review-focus.mark`     | mark/unmark the selected file — prompts for an optional reason, like lumen's `i` |
| `m`      | `review-focus.markHunk` | mark the selected hunk reviewed, then advance to the next hunk                   |
| `space`  | `review-focus.markFile` | mark every hunk in the selected file reviewed                                    |
| `ctrl+f` | `review-focus.toggle`   | show/hide the Start here pane                                                     |
| `ctrl+g` | `review-focus.first`    | jump to the first marked file                                                     |

`i` writes the mark immediately and asks Hunk to refresh, so the reorder happens without
leaving the session. `m`/`space` update the Start here pane's progress line and per-file
markers (`✓` fully reviewed, `·` partially) without a refresh — nothing they touch reorders
files. The pane lists every marked file **and** every file with any review progress, even one
you never marked — reviewing a file doesn't require marking it first for the mark to show
somewhere. It hides itself only when there is neither a mark nor any review progress at all.

Hunk's own built-in files pane is untouched — `review-focus` only reorders which files it
lists (see above), it doesn't replace how they're drawn. Every marker lives in the Start here
pane instead: `★` before a marked file's path (blank for a file that's only reviewed, never
marked), `▸` before its reason on the line beneath, and `✓`/`·` for reviewed progress — three
symbols so a mark, its note, and review progress never read as the same kind of information.

`m` and `space` claim keys the built-ins default to (`hunk.view.toggleHunkHeaders`,
`hunk.review.pageDown`), so `~/.config/hunk/config.toml` remaps those first — see
[Install](#install). `toggleHunkHeaders` moves to the Extensions menu; `pageDown` keeps
`pagedown` and `f`.

Reviewed state persists per file, keyed by the file's own patch text: if the diff under a
file changes (a force-push, a new commit), that file's reviewed marks are dropped rather
than shown against hunks that may no longer be the ones reviewed. Stored outside the repo
in `${XDG_STATE_HOME:-~/.local/state}/review-focus/reviewed.json`, same as marks.

## Config

```toml
[extension.review-focus]
testPatterns = ["**/*_it.kt"]        # added to the built-in test patterns
generatedPatterns = ["**/*.gen.ts"]  # added to the built-in generated patterns
demoteTests = true
demoteGenerated = true
```

## Install

`~/.config/hunk/config.toml` in this repo already points at this directory:

```toml
[extensions]
paths = ["~/git/dotfiles/harness/apps/review-focus"]
```

So `mise run stow` is the install. To load it for one run without any config:

```bash
hunk diff --extension ~/git/dotfiles/harness/apps/review-focus
```

## Development

`node_modules/` here holds **types only** — `hunkdiff`, `react`, `@opentui/*`. Hunk serves
its own React to extension files at import time; shipping a second copy breaks the pane.

```bash
npm install     # types for the typecheck
npx tsc --noEmit
bun test        # classify.test.ts, store.test.ts
```
