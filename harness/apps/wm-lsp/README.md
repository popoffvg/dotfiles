# wm-lsp

The language server and the lint command for the files of a wm notes corpus: `INTENT.spec`, `todos/TODO-N.todo`, `TODO-N.agent.todo`, `TODO-N.test.todo`, and `GLOSSARY.terms`. The old names (`spec.md`, `TODO-N.md`, `GLOSSARY.md`) still work. Every file type, field, allowed value, and section order comes from one table, `harness/plugins/wm/schema/frontmatter.toml`, which the binary embeds at build time.

## Layout

```
server/src/
  schema.rs    # loads the table, matches a file name to its row, finds TODO files
  check.rs     # the check core: one file in, its findings out
  corpus.rs    # a notes dir: its files, lint over all of them, the ledger state
  lsp.rs       # diagnostics, completion, hover, go-to-definition, quick fixes
  main.rs      # `wm-lsp` (server), `wm-lsp lint`, `wm-lsp next`
src/lib.rs, extension.toml
               # the Zed extension: starts the server for Markdown files
```

Claude Code starts the same server from `harness/plugins/wm/.lsp.json`.

## Install

```sh
mise run harness:wm-lsp:build       # → ~/.local/bin/wm-lsp
```

Then, once per machine, register the extension in Zed:

1. Run `zed: install dev extension` and pick `harness/apps/wm-lsp`. Zed compiles the WASM. It needs `rustup` and the `wasm32-wasip2` target.
2. The notes files open as Markdown through `file_types` in `.config/zed/settings.json`, and `wm-lsp` is in the Markdown `language_servers` list there. Open an `INTENT.spec` or a `.todo` file.

After a change to `src/lib.rs`, run `zed: rebuild dev extension`. After a change to the server or the table, run the mise build task again, then `editor: restart language server`.

## Commands

```sh
wm-lsp lint <notes-dir> [--json]    # a verdict per check, then every finding; exit 0 clean, 1 finding, 2 not a notes dir
wm-lsp next <notes-dir>             # each TODO, its status, and whether it is ready
```

A sample corpus with mistakes on purpose, and a script that talks LSP over stdio, are in `~/git/wm-lsp-demo`.
