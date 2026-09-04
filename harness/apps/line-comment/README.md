# line-comment

Review comments on a line, or on a selection of lines, of any file in Zed, kept out of the file. A code action hands you a
small input file, you type the comment and save, the comment shows at the end of the line as
an inlay hint and a Hint diagnostic, and `/line-comment:act` hands the collected comments to
Claude.

`SPEC.md` holds the design. This file is how to install and check it.

## Install

```sh
mise run harness:line-comment:build      # → ~/.local/bin/line-comment-lsp
mise run stow                            # Zed settings.json
```

The four Claude commands are the `line-comment` plugin (`harness/plugins/line-comment`),
installed from the `local-plugins` marketplace, not stowed.

Then, once per machine, register the extension in Zed:

1. `zed: install dev extension` → pick `harness/apps/line-comment` (the directory holding
   `extension.toml`; picking a parent fails with "No extension manifest found").
2. Zed compiles the WASM itself. It needs `rustup` and the `wasm32-wasip2` target
   (`rustup target add wasm32-wasip2`).

After editing `src/lib.rs`, run `zed: rebuild dev extension` — plain
`zed: reload extensions` does not recompile. After editing the server, re-run the mise
build task.

**Rebuild only from a Zed started in a shell.** Zed compiles the extension with the `rustc`
on its own process PATH, and a Zed started from the dock inherits the launchd PATH
(`/usr/bin:/bin:/usr/sbin:/sbin`), which has no `~/.cargo/bin`. The rebuild then fails and
takes the whole extension down with it — no server attaches, so every code action, hint and
diagnostic goes. The Zed log names it:

```
ERROR failed to compile Rust extension: failed to run rustc: No such file or directory (os error 2)
```

Read the PATH Zed actually has with `ps -Eww -p $(pgrep -f MacOS/zed | head -1) | tr ' ' '\n' | grep ^PATH=`.
To recover, quit Zed and start it again from a terminal. A restart alone is enough to get
the comments back — Zed loads the `extension.wasm` already on disk and does not recompile
on startup.

Zed's `extension.toml` has no wildcard for languages, so the server attaches only to the
names in its `languages` array. Regenerate that array from the languages installed on this
machine after installing a language extension:

```sh
mise run harness:line-comment:languages   # then `zed: rebuild dev extension`
```

**Either way, finish with `editor: restart language server` on a served file.** A rebuild
stops the running server and does not start a new one, so the hints and code actions simply
vanish until you restart it — which reads exactly like a crash. The Zed log shows
`stopping language server line-comment-language-server` with no matching
`starting language server process`.

The stowed `.config/zed/settings.json` already carries the keys the feature needs:

```json
"Markdown": {
  "language_servers": ["marksman", "line-comment-language-server"],
  "inlay_hints": { "enabled": true, "show_other_hints": true }
}
```

Without `show_other_hints` the hints are hidden — Zed files a kind-less hint under
"other hints", and that flag is off in the global block. Only Markdown carries that
override, so **in every other language the inlay hint does not show and the diagnostic is
the only display.** Turning the flag on globally would also surface every other language
server's kind-less hints, which is why it stays per-language.

Comments are also published as `Hint` diagnostics, which is the more dependable display:
they appear in the diagnostics panel with jump-to whatever the hint settings say. The
end-of-line text needs the global block the settings also carry, because Zed's diagnostics
settings are editor-wide rather than per-language:

```json
"diagnostics": { "inline": { "enabled": true, "max_severity": "hint" } }
```

If Zed reports it cannot find the binary, point it straight at the path:

```json
"lsp": {
  "line-comment-language-server": {
    "binary": { "path": "/Users/<you>/.local/bin/line-comment-lsp" }
  }
}
```

## Use

Everything happens in the code-actions menu (`editor: toggle code actions`, or right-click
→ Show Code Actions).

| Code action | Effect |
|---|---|
| `add comment` (uncommented line) | opens a fresh `.tmp/line-comment-input-<nonce>.md` aimed at that line — type the comment under the header and **save** |
| `add comment on lines <a>-<b>` (selection) | the same, aimed at every line the selection touches; the diagnostic then underlines the whole block |
| `edit comment: …` (commented line) | the same, aimed at the existing comment and pre-filled with the text it holds; saving replaces that text |
| `delete comment: …` | drops that comment |
| `list comments` | re-anchors, writes the export, then opens a fresh `.tmp/line-comment-list-<nonce>.md` — every comment in lumen format |
| `copy comments` | re-anchors everything, then writes `.tmp/line-comment.md` in lumen format, without opening it |
| `reset comments` | asks first, then clears every comment in the workspace |

The input file quotes the lines it aims at under the header — the selection, or the line the
cursor stood on — so you read what the comment is about while writing it. That quote is a
tip: it sits in a markdown comment block, the server drops it again on save, and editing or
deleting it changes nothing. A selection longer than 10 lines is cut short with a count of
the rest.

Saving the input file with **nothing** under the quote cancels the pending comment. The
body may run to several lines; the hint shows the first 40 characters and the tooltip and
the export carry all of it.

The server learns of the save through a watch it registers on the input files
(`workspace/didChangeWatchedFiles`), so the file does not need to stay open. Anything left
in an input file when the server dies is picked up the next time it starts.

Every code action gets an input file of its own, and the file is deleted the moment its
comment is stored — a reused path is one the editor still holds a buffer on, and rewriting
it underneath that buffer is what makes the editor ask whether to overwrite. `list comments`
works the same way, and drops the views it handed over earlier. The tab of a comment already
stored is a tab on a file that no longer exists; close it.

The file is put in front of you twice over: the server-side edit that fills it opens it
over a plain tab, and over a changes-review multibuffer that edit opens nothing at all, so
the server also runs `zed --existing` on the path. It takes the CLI from
`LINE_COMMENT_ZED`, then from the PATH, then from `/usr/local/bin`, `/opt/homebrew/bin`
and `/Applications/Zed.app/Contents/MacOS/cli` — a Zed started from the dock passes on the
launchd PATH, which names no package manager's prefix. `LINE_COMMENT_ZED=off` opens
nothing, and that is what the tests and the probe set.

In a **commit view** — a past commit opened from the git panel — there is no code-actions
menu to use. Zed builds those buffers from `git cat-file`, and no language server is attached
to them, so `cmd+.` reports nothing and a task there is given no `ZED_FILE` either. `cmd-.` is
rebound there instead: it copies `<file>:<line>` from the diff and runs
`line-comment-lsp add "$(pbpaste)"`, which hands over the same input file. `cmd-alt-y` is the
second half alone, for a location copied some other way. The comment then lands on the working tree's file at that line — on the tip commit that
is the line you were looking at, on an older one check it before you trust it.

The path a commit view copies is relative to the git repository, so `add` looks for it inside
each repository under the project root. Two worktrees of one repository hold the same path, and
nothing in that view says which commit you were reading — so the first in path order is taken
and the rest are named in the input file, under the quoted lines:

```
<!-- line-comment: pl/platform/auth/login_method_test.go:12 -->
<!-- commenting on:
func TestLoginMethod(t *testing.T) {
--
this line also exists in:
  pl-stack/platform/auth/login_method_test.go
change the path in the header above to comment on one of those instead
-->
```

The quoted line tells you whether the guess was right; if it was not, edit the path in the
header before saving.

The comment also records the revision it was read on. `add` asks `git blame` which commit last
changed that line, writes it as a second marker under the header, and the stored comment ends
with `read on 36d8b4b6c4a2` — so a later reader can tell whether the line they are looking at is
still the line you commented on. It sits at the end, so the hint and the export still open with
your own sentence, and an uncommitted line simply gets no revision. `alt-o` is the other way out — it opens the file as a normal project tab,
where the code-actions menu works as it does anywhere else.

Two displays carry the same comments: an inlay hint at the end of the line, and a `Hint`
diagnostic over that line (panel entry, plus inline text when inline diagnostics are on). A
comment over a selection hints on the first line of the block and underlines all of it, and
its code actions are offered from every line it covers.

The store is `<root>/.tmp/line-comment.json`; the export is `<root>/.tmp/line-comment.md`; a
rendered list view is `<root>/.tmp/line-comment-list-<nonce>.md`. All of them are gitignored —
the server appends `.tmp/` to the root's `.gitignore` when the root is a git repository.

Then, in Claude, through the `line-comment` plugin:

| Command | What it does |
|---|---|
| `/line-comment:act` | reads the store with `line-comment-lsp list`, moves it into `.tmp/act-session/<id>/` to claim the batch, acts on each comment in a fork per file, and records the outcome in `processed.md` beside the moved store |
| `/line-comment:write` | places comments on lines instead of writing them in chat |
| `/line-comment:unresolved` | prints what the store still holds, and edits nothing |
| `/line-comment:prune` | throws comments away without acting on them |

A drop from any of them reaches the running server through its watch on the store, so the
hints go without a restart.

From a shell, the same binary writes and reads the store with no editor involved:

```sh
line-comment-lsp comment <file>:<lines> <text>  # attach or replace a comment (12 or 12-18)
line-comment-lsp add <file>:<lines>             # open an input file for that target and reveal it
line-comment-lsp drop <file>:<line>...          # remove the comments starting there
line-comment-lsp drop --all                     # remove every comment
line-comment-lsp list                           # print them in lumen format
```

## Checks

```sh
mise run harness:line-comment:test
```

To tell a server fault from an editor problem, drive the binary directly:

```sh
harness/plugins/line-comment/scripts/probe.py            # throwaway workspace
harness/plugins/line-comment/scripts/probe.py <file.md>  # a real file
```

It runs the whole flow — capabilities, code actions, `add comment`, the input file, the
save, the hint — and prints each step. A PASS means the problem is editor-side.

The server also writes one line per event to `$TMPDIR/line-comment-lsp.log`
(`LINE_COMMENT_LOG=off` disables it, or set it to another path), because a language server's
stderr goes nowhere a person can read. That log answers "did Zed even start it, and what
did it ask for".

Then in Zed, by hand:

1. Code actions on a markdown line list `add comment`.
2. Choosing it opens the input file with a `<!-- line-comment: <file>:<line> -->` header and the
   target line quoted under it.
3. Type a comment, save — `💬 <text>` appears at the end of the target line.
4. Code actions on that line now list `edit comment` and `delete comment`; delete removes the hint.
5. Select several lines — the menu lists `add comment on lines <a>-<b>`; the comment underlines
   every line of the block, and `edit comment` is offered from each of them.
6. `list comments` — the rendered view opens and matches lumen's format; running it again opens a new one and the previous file is gone.
7. `copy comments` — the message names the path, and the file matches lumen's format.
8. `reset comments` — the confirmation appears; `Cancel` keeps the comments, `Delete` clears them.
9. The comment also shows in the diagnostics panel, and deleting it clears the entry.
10. In the changes-review view, `add comment` on a changed line opens the input file too,
    and the comment lands on that line of the real file.
