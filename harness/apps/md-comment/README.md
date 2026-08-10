# md-comment

Review comments on markdown lines in Zed, kept out of the file. A code action hands you a
small input file, you type the comment and save, the comment shows at the end of the line as
an inlay hint and a Hint diagnostic, and `/md-comment` hands the collected comments to
Claude.

`SPEC.md` holds the design. This file is how to install and check it.

## Install

```sh
mise run harness:md-comment:build      # → ~/.local/bin/md-comment-lsp
mise run stow                          # settings.json + the /md-comment command
```

Then, once per machine, register the extension in Zed:

1. `zed: install dev extension` → pick `harness/apps/md-comment` (the directory holding
   `extension.toml`; picking a parent fails with "No extension manifest found").
2. Zed compiles the WASM itself. It needs `rustup` and the `wasm32-wasip2` target
   (`rustup target add wasm32-wasip2`).

After editing `src/lib.rs`, run `zed: rebuild dev extension` — plain
`zed: reload extensions` does not recompile. After editing the server, re-run the mise
build task.

**Either way, finish with `editor: restart language server` on a markdown file.** A rebuild
stops the running server and does not start a new one, so the hints and code actions simply
vanish until you restart it — which reads exactly like a crash. The Zed log shows
`stopping language server md-comment-language-server` with no matching
`starting language server process`.

The stowed `.config/zed/settings.json` already carries the two keys the feature needs:

```json
"Markdown": {
  "language_servers": ["marksman", "md-comment-language-server"],
  "inlay_hints": { "enabled": true, "show_other_hints": true }
}
```

Without `show_other_hints` the hints are hidden — Zed files a kind-less hint under
"other hints", and that flag is off in the global block.

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
  "md-comment-language-server": {
    "binary": { "path": "/Users/<you>/.local/bin/md-comment-lsp" }
  }
}
```

## Use

Everything happens in the code-actions menu (`editor: toggle code actions`, or right-click
→ Show Code Actions).

| Code action | Effect |
|---|---|
| `add comment` (uncommented line) | opens `.tmp/md-comment-input.md` aimed at that line — type the comment under the header and **save** |
| `edit comment: …` (commented line) | the same input file, aimed at the existing comment; saving replaces its text |
| `delete comment: …` | drops that comment |
| `list comments` | re-anchors, writes the export, then opens `.tmp/md-comment-list.md` — every comment in lumen format |
| `copy comments` | re-anchors everything, then writes `.tmp/md-comment.md` in lumen format, without opening it |
| `reset comments` | asks first, then clears every comment in the workspace |

Saving the input file with **nothing** under the header cancels the pending comment. The
body may run to several lines; the hint shows the first 40 characters and the tooltip and
the export carry all of it.

The server learns of the save through a watch it registers on the input file
(`workspace/didChangeWatchedFiles`), so the file does not need to stay open. Anything left
in the input file when the server dies is picked up the next time it starts.

Two displays carry the same comments: an inlay hint at the end of the line, and a `Hint`
diagnostic over that line (panel entry, plus inline text when inline diagnostics are on).

The store is `<root>/.tmp/md-comment.json`; the export is `<root>/.tmp/md-comment.md`; the
rendered list is `<root>/.tmp/md-comment-list.md`. All three are gitignored — the server appends `.tmp/` to the root's `.gitignore` when the root
is a git repository.

Then, in Claude: `/md-comment` reads the export and acts on each comment.

## Checks

```sh
mise run harness:md-comment:test
```

To tell a server fault from an editor problem, drive the binary directly:

```sh
~/.claude/scripts/md-comment-probe.py            # throwaway workspace
~/.claude/scripts/md-comment-probe.py <file.md>  # a real file
```

It runs the whole flow — capabilities, code actions, `add comment`, the input file, the
save, the hint — and prints each step. A PASS means the problem is editor-side.

The server also writes one line per event to `$TMPDIR/md-comment-lsp.log`
(`MD_COMMENT_LOG=off` disables it, or set it to another path), because a language server's
stderr goes nowhere a person can read. That log answers "did Zed even start it, and what
did it ask for".

Then in Zed, by hand:

1. Code actions on a markdown line list `add comment`.
2. Choosing it opens the input file with a `<!-- md-comment: <file>:<line> -->` header.
3. Type a comment, save — `💬 <text>` appears at the end of the target line.
4. Code actions on that line now list `edit comment` and `delete comment`; delete removes the hint.
5. `list comments` — the rendered list opens and matches lumen's format.
6. `copy comments` — the message names the path, and the file matches lumen's format.
7. `reset comments` — the confirmation appears; `Cancel` keeps the comments, `Delete` clears them.
8. The comment also shows in the diagnostics panel, and deleting it clears the entry.
