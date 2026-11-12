# review-mark

A language server for Zed that marks the changed hunks of a file, and the whole file, as reviewed. The diff base is `HEAD`, the same base as the Zed "Uncommitted Changes" view.

## What it shows

- A code lens above the first line of each hunk: `✅ hunk reviewed · file 2/3` or `⬜ hunk not reviewed · file 2/3`. A click toggles the hunk. The lens shows in the file and in the Zed project diff.
- A code lens on line 1: `✅ file reviewed 3/3` or `⬜ file reviewed 2/3`. A click toggles the file.
- Outline symbols: one file symbol with one child per hunk, with the same marks. The outline panel shows them only for a language with `"document_symbols": "on"` (see below).
- Two code actions in the `cmd-.` menu: `review: mark hunk reviewed` (only on a line of a hunk) and `review: mark file reviewed`. On a reviewed item the verb is `unmark`.

## Rules

- A file with no change against `HEAD`, a file outside a git work tree, and a file git ignores get nothing.
- A hunk is a run of changed lines. Its id is a hash of its removed and added lines. A line shift keeps the mark. A change to the hunk text drops the mark.
- A file is reviewed when each of its current hunks is reviewed. `toggle file` marks every hunk when one is not reviewed, else it unmarks them all.
- The marks live in `<repo>/.tmp/review-mark.json`. A new `.tmp/` gets a `.gitignore` of `*`.

## Install

```sh
mise run harness:review-mark:build      # → ~/.local/bin/review-mark-lsp
```

Then, once per machine:

1. Run `zed: install dev extension` and pick `harness/apps/review-mark`. Zed compiles the WASM. It needs `rustup` and the `wasm32-wasip2` target. Start Zed from a shell, so that its PATH has `~/.cargo/bin` (see `harness/apps/line-comment/README.md`).
2. Set `"code_lens": "on"` in `settings.json`.
3. For the outline marks, set `"document_symbols": "on"` for each language that needs them. Zed then builds the outline from the language servers and not from tree-sitter, so set it only for a language whose main server gives symbols (gopls, rust-analyzer, marksman).

After a server change, run the build task again, then `editor: restart language server`. After a Zed language extension install, run `mise run harness:review-mark:languages`, then `zed: rebuild dev extension`.

## Limits

- Zed has no request to refresh the outline. After a toggle the server registers its symbol provider again, and Zed reads the symbols again on that change.
- Two identical hunks in one file share one id, so one toggle marks both.
