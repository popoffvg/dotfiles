# review-focus

A Hunk extension that orders a review by what is worth reading.

Three signals, in this order:

1. **Marked files** — `hunk focus generate` asks an agent to rank the diff, or you mark files by hand with `hunk focus add`. Marked files sort to the top, in mark order, and are what the **Start here** pane lists, each with its reason.
2. **Test files** — matched by path, sorted below everything unmarked.
3. **Generated protobuf output** — `*.pb.go`, `*_pb2.py`, `*.pb.ts`, and friends, sorted last.

Marking a file beats both demotions: a `.pb.go` file you marked reads first.

Separately, `review-focus` tracks which hunks and files you've actually reviewed (`m`/`space`
below) — that state doesn't reorder anything, it just shows progress.

## CLI

```bash
hunk focus generate                 # working tree vs HEAD
hunk focus generate main...HEAD     # any git diff revisions
hunk focus generate --skip          # never ask; reuse a stored ranking or open empty
hunk focus generate --force         # ask again even when this commit is already ranked
hunk focus add src/auth/session.rs --why "token minting moved before identity bind"
hunk focus add src/cli/root.rs
hunk focus list
hunk focus rm src/cli/root.rs
hunk focus clear --yes
```

### `generate`

`generate` is how Start here is meant to be filled. It sends the agent the changed paths with
their `+`/`-` counts — not the patch — and lets the agent open the files it cares about with
its own tools, so a large pull request costs the same prompt as a small one. The reply is a
JSON array of `{path, why}`, at most 8 files, ranked; any path the diff does not carry is
dropped before anything is written.

The answer **replaces** the marks rather than merging into them: the pane then shows one
coherent reading order instead of this run's ranking layered over a stale one. Hand marks from
`i` or `focus add` are part of what it replaces — re-add them after, or skip `generate` on a
review you are marking by hand.

### One ranking per commit

Before the agent is considered, `generate` looks for the file that would already hold this
review's answer:

```
~/.local/state/review-focus/rankings/<review>__<commit>.json
```

`<review>` is `PRX_REVIEW_KEY` when prx exports one (slugged — `milaboratory-repo-123`) and the
repository root otherwise; `<commit>` is `git rev-parse HEAD`. **The file name is the whole
cache key**: if it exists, this pull request was already ranked at this commit, the stored
marks are replayed, and the agent is never spawned. Nothing inside the file is compared, and an
older commit keeps its own file instead of being overwritten.

The key must be the review and not the worktree, because a prx worktree is a throwaway temp
directory: keyed on the path, no ranking could ever be reused. That is why prx exports
`PRX_REVIEW_KEY` around `focus generate`, not only around the TUI.

`--skip` never asks: it replays the stored file if there is one and otherwise leaves Start here
empty — for opening a review you do not want to pay for. `--force` asks again and overwrites
the file for this commit. Because the identity is the commit and not the diff, a working tree
edited on top of the same commit reuses the old ranking; `--force` is how you re-rank it.

### Waiting for it

It blocks the terminal until it answers, because the marks are read once, when the review
loads. `prx` prints the file count it wrote just before launching Hunk, so an empty Start here
is distinguishable from a ranking that never ran. Every failing path — a git revision Git
rejects, an agent that exits non-zero or times out, a reply with no usable array — prints its
reason and exits non-zero; none of them opens an empty pane silently.

The agent is `claude -p --model haiku`, or whatever `REVIEW_FOCUS_AGENT` and
`REVIEW_FOCUS_AGENT_MODEL` name. Haiku is the default because ranking is triage, not review:
it names the files and one line each, and the slower tiers spent minutes on that while the
reviewer waited on a blank terminal. It is read from the
environment and never from `hunk.config`, because extension config is layered user-then-repo:
a repository under review must not be able to name what gets executed.

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
| `ctrl+f` | `review-focus.toggle`   | show/hide Start here                                                              |
| `ctrl+b` | `review-focus.files`    | show/hide Hunk's own file list, which starts closed                               |
| `ctrl+g` | `review-focus.first`    | jump to the first marked file                                                     |

`i` writes the mark immediately and asks Hunk to refresh, so the reorder happens without
leaving the session. `m`/`space` update the Start here progress line and per-file markers
(`✓` fully reviewed, `·` partially) without a refresh — nothing they touch reorders files.
Start here lists every marked file **and** every file with any review progress, even one you
never marked — reviewing a file doesn't require marking it first for the mark to show
somewhere.

## The pane

Start here is the left column a review opens on. It registers with `replaces: "hunk:files"`,
which means it starts open in the files pane's place and Hunk's own file list starts closed —
the first thing on screen is the ranked reading order, not every changed path. The file list is
still registered and still reordered by the three signals above.

Both panes toggle: `ctrl+f` for Start here, `ctrl+b` for the file list. `ctrl+b` exists because
Hunk's own `hunk.view.toggleFilesPane` follows whichever pane *owns* the files slot — which is
now this one — so the built-in list needs a key that addresses `"hunk:files"` literally.
Without it, replacing the slot would hide the file list for the rest of the session.

With no ranking and no review progress, the pane names what is missing rather than saying
"nothing here" — which reads the same whether the ranking never ran, failed, or genuinely had
nothing to say:

```
 Start here
 no ranking for this diff
 run `hunk focus generate`
 ctrl+b for the plain file list
```

Ranked files are drawn as a tree, one heading per directory, because the paths of a ranking
repeat their leading directories and repeating them costs the columns a 36-wide pane does not
have:

```
 Start here
 0 file(s), 0/120 hunks reviewed
 harness/apps/review-focus/
 ├──  ★ store.ts
 │   +63 -5
 │   > read-modify-write with no lock — concurrent
 │   > edits lose state
 └──  ★ index.tsx
     +225 -70
     > commentId joins 4 fields with a space —
     > collides when a summary contains one
 .config/hunk/
 └──  ★ config.toml
     +10 -0
     > points at the review-focus dir — verify it loads
```

The tree groups but never sorts: a directory takes the position of its best-ranked file, and
the files inside keep the order the agent gave them, because that order is the whole point of
the pane. A directory that reappears further down joins the heading it already has, so a
reader never meets the same directory twice.

Each listed file carries `★` when it is marked (blank for a file that is only reviewed, never
marked), `✓`/`·` for reviewed progress, its `+`/`-` stats, and its reason underneath: the
reason's first line as a plain header, every line after it as a `>` markdown quote, word-
wrapped to the pane. A reason typed at `i` is a single line and is all quote, so nothing a
human types is mistaken for a header. The quote paints in the theme's `noteBorder` — the tone
Hunk reserves for agent-written notes — because that text is the agent's, not the reviewer's.

`m` and `space` claim keys the built-ins default to (`hunk.view.toggleHunkHeaders`,
`hunk.review.pageDown`), so `~/.config/hunk/config.toml` remaps those first — see
[Install](#install). `toggleHunkHeaders` moves to the Extensions menu; `pageDown` keeps
`pagedown` and `f`.

Reviewed state persists per file, keyed by the file's own patch text: if the diff under a
file changes (a force-push, a new commit), that file's reviewed marks are dropped rather
than shown against hunks that may no longer be the ones reviewed. Stored outside the repo
in `${XDG_STATE_HOME:-~/.local/state}/review-focus/reviewed.json`, same as marks.

## Saved comments

A Hunk session holds its inline notes in memory and drops them when the window closes. Every
saved note is therefore mirrored to `comments.json` beside the other two stores, keyed by
`PRX_REVIEW_KEY` when the environment sets one and by the repository root otherwise — a `prx`
worktree is thrown away after each run, so only the pull request it opened can key its notes.

`~/.claude/scripts/prx-comments.sh` is the other half: it restores the store into a fresh
session and drops the notes the PR already carries. It does not post — `S` (the
[hunk-gh-review](https://github.com/phl28/hunk-gh-review) extension) submits the live session
as one atomic review and clears what it submitted, and that clearing arrives here as
`note_changed: removed`, so the store empties itself on a successful submit.

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
bun test        # classify.test.ts, store.test.ts, quote.test.ts, generate.test.ts
```
