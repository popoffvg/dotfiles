# md-comment — implementation spec

**Goal:** the operator writes review comments on markdown lines in Zed without changing the file, and `/md-comment` hands those comments to Claude in lumen annotation format.

## Mental model

**A code action hands over an input file.** Zed exposes no LSP request that opens a text box, and a code action's command reaches only the language server, never an editor action. What a server can do is create a file through `workspace/applyEdit` — and a create carrying a text edit makes the client put that file in front of the operator. So `add comment` writes a one-line header naming the target into `.tmp/md-comment-input.md`; the operator types under it and saves.

**A watch turns the save into a notification.** The server registers `workspace/didChangeWatchedFiles` on the input file through `client/registerCapability`, so it learns of the save whether or not the file is an open buffer. The watch only reports changes while the server lives, so the server also drains the input file at startup — a comment typed before a crash is not lost.

**The comments live beside the file, never in it.** The server keeps one JSON store per Zed project under `.tmp/`. Nothing the server does writes into the markdown buffer.

**Two displays carry the comments, and code actions change them.** An inlay hint sits at the end of each commented line, and the same comment is published as a `Hint` diagnostic over that line — the diagnostic is the dependable one, because it reaches the diagnostics panel whatever the hint settings say, and it renders inline when inline diagnostics are on. Zed drops the `command` field of hint label parts, so neither display can be clicked; add, edit, delete, list, copy and reset are all code actions.

**Claude reads an exported file, not the store.** The `copy comments` action writes lumen-format markdown to `.tmp/md-comment.md`. The `/md-comment` command reads that file and treats each block as a task on that file and line.

The whole cycle:

```
code action ──► .tmp/md-comment-input.md ──► save ──► watch ──► store (.tmp/md-comment.json)
                              │
                              ├─► inlayHint   ──► 💬 hint at end of line
                              ├─► diagnostics ──► panel entry + inline text
                              ├─► codeAction  ──► edit / delete / list / copy / reset
                              ├─► list        ──► .tmp/md-comment-list.md (opened)
                              └─► copy        ──► .tmp/md-comment.md ──► /md-comment ──► Claude
```

## Not in scope

- More than one comment per line. `add comment` on a commented line replaces that comment.
- Replies, threads, resolve state, authorship, timestamps.
- Comments in git. The store and the export are gitignored.
- Any language but Markdown.
- Clipboard access. A language server cannot write the system clipboard.
- Reading store changes made by another process. The server owns the store file while it runs; it does not watch it.
- Publishing to the Zed extension marketplace. The extension stays a dev extension.
- The rename overlay as the input. It worked (a zero-width `prepareRename` range opens the box empty), but writing through a file keeps every gesture in one menu and allows a multi-line comment.
- Tasks as a comment-writing path. A language server cannot contribute a task (that channel is one vendor's `experimental.runnables`, gated by a settings key only that adapter reads), and a task template has no input or prompt field, so a task can only collect text by prompting inside a terminal.

## Invariants

1. The server never edits a commented markdown file. Its only writes are the store file, the export file, the input file, and one `.gitignore` line.
2. At most one comment exists per (file, line).
3. A comment disappears only through `delete comment` or `reset comments`. Every other path keeps it, marked orphaned when its anchor is lost.
4. Store paths are workspace-root-relative with `/` separators.
5. Store and export line numbers are 1-based, matching lumen. LSP wire positions are 0-based; conversion happens at the protocol edge only.
6. The store file is replaced atomically: write `md-comment.json.tmp`, then rename over the target.
7. The server answers for markdown files only, and never for a file inside `<root>/.tmp/`.

## API anchors

### Extension shim

`harness/apps/md-comment/extension.toml`:

```toml
id = "md-comment"
name = "Markdown Comment"
version = "0.1.0"
schema_version = 1
description = "Review comments on markdown lines, kept outside the file"
repository = "https://github.com/popoffvg/dotfiles"
authors = ["Vitalii Popov"]

[lib]
kind = "Rust"

[language_servers.md-comment-language-server]
name = "Markdown Comment Language Server"
languages = ["Markdown"]
```

`src/lib.rs` implements one method:

```rust
fn language_server_command(&mut self, _id: &LanguageServerId, worktree: &Worktree)
    -> Result<Command>
{
    let path = worktree.which("md-comment-lsp")
        .unwrap_or_else(|| format!("{}/.local/bin/md-comment-lsp", std::env::var("HOME").unwrap()));
    Ok(Command { command: path, args: vec![], env: Default::default() })
}
```

The extension must not carry the binary — Zed's extension policy forbids it, and the mise task already puts it on disk.

### Server capabilities

```json
{
  "textDocumentSync": { "openClose": true, "change": 2, "save": { "includeText": false } },
  "codeActionProvider": { "codeActionKinds": ["refactor"] },
  "executeCommandProvider": {
    "commands": [
      "md-comment.add", "md-comment.list",
      "md-comment.delete", "md-comment.copy", "md-comment.reset"
    ]
  },
  "inlayHintProvider": true
}
```

`change: 2` is incremental sync. Zed only offers a code action whose command appears in `executeCommandProvider.commands`, and only advertises the literal kinds `refactor`, `quickfix`, `source` — hence `refactor`.

### Request handling

| Request | Behaviour |
|---|---|
| `initialize` | Resolve the root, load or create the store, ensure `.tmp/` and its gitignore line. |
| `textDocument/inlayHint` | One hint per comment whose line falls inside the requested range. |
| `textDocument/codeAction` | `add comment` when the cursor line has none; `edit comment: <text…>` and `delete comment: <text…>` for each comment in the range; `list comments`, `copy comments` and `reset comments` always. |
| `workspace/executeCommand` | The five commands below. |
| `didOpen` | Reconcile every comment of that file by hash. |
| `didChange` | Shift or refresh anchors from the change ranges. |
| `didSave` | Drain the input file when that is what was saved, else persist the store. |
| `workspace/didChangeWatchedFiles` | Drain the input file. |

### Diagnostic shape

```json
{
  "uri": "file:///…/docs/spec.md",
  "diagnostics": [{
    "range": { "start": { "line": 11, "character": 0 }, "end": { "line": 11, "character": 42 } },
    "severity": 4,
    "source": "md-comment",
    "message": "needs a source"
  }]
}
```

Severity 4 is `Hint`, the quietest level, and the range covers the whole anchored line so the editor marks the text the comment is about. An orphaned comment gets ` (orphaned)` appended to its message. The server publishes for every file in the store — open or not, which is what fills the diagnostics panel — and sends an **empty** list for any file it published before that now has none, because an editor keeps showing what it was last told.

### Inlay hint shape

```json
{
  "position": { "line": 11, "character": 42 },
  "label": "💬 needs a source",
  "paddingLeft": true,
  "tooltip": { "kind": "markdown", "value": "needs a source" }
}
```

`character` is the UTF-16 length of the anchored line, putting the hint at the end of the line. The label is `💬 ` plus the text truncated to 40 characters with a trailing `…`; an orphaned comment uses `💬? `. The hint carries **no `kind`**, which is why `Markdown.inlay_hints.show_other_hints` must be true — Zed treats a missing kind as the `None` bucket and gates it on that flag.

### Commands

| Command | Arguments | Effect |
|---|---|---|
| `md-comment.add` | `[uri, line]` (1-based line) | Write the input file for that target through `workspace/applyEdit`, so the client shows it, and name the path in a message. Also serves `edit comment`, with the existing comment's line. |
| `md-comment.delete` | `[uri, line]` (1-based line) | Drop that comment, persist, refresh hints. |
| `md-comment.list` | `[]` | Re-anchor, write the export, then hand over `<root>/.tmp/md-comment-list.md` with the same content through `workspace/applyEdit`, so the client opens it. With no comments, say so and open nothing. |
| `md-comment.copy` | `[]` | Re-anchor every comment against the file as it stands, then write the export for the whole store and `window/showMessage` (Info): `"12 comments → .tmp/md-comment.md"`. |
| `md-comment.reset` | `[]` | Ask through `window/showMessageRequest`: `"Delete 12 comments in 3 files?"` with actions `Delete` and `Cancel`. On `Delete`, clear the store, persist, refresh hints. On `Cancel` or a null reply, do nothing. |

All three return `null`; none returns a workspace edit.

### Store file

`<root>/.tmp/md-comment.json`:

```json
{
  "version": 1,
  "files": {
    "docs/spec.md": [
      { "line": 12, "hash": "9f2b1c4e7a05d381", "text": "needs a source", "orphaned": false }
    ]
  }
}
```

`hash` is the first 16 hex characters of the SHA-256 of the anchored line with trailing whitespace removed. Comments are stored sorted by line, files sorted by path. An unknown `version` aborts loading with a `window/showMessage` error rather than overwriting the file.

### Input file

`<root>/.tmp/md-comment-input.md`, one header line and then whatever the operator types:

```markdown
<!-- md-comment: docs/spec.md:12 -->

needs a source
```

Parsing takes the first line containing the marker, splits the target on its **last** colon so a path may hold colons, and treats everything after that line as the body, trimmed. A body of several lines is kept whole — the hint shows the first 40 characters, the tooltip and the export carry all of it. Draining empties the file, so a second save of the same content stores nothing. An empty body cancels the pending comment.

### Export file

`<root>/.tmp/md-comment.md`, byte-faithful to lumen's `format_annotations_for_export`:

```
# markdown comments

**docs/spec.md** line 12 (RIGHT)

needs a source

---

**docs/plan.md** line 3 (RIGHT) (orphaned)

this contradicts the spec
```

Rules: header line, then one block per comment joined by `---` on its own line, blank lines exactly as shown, `(RIGHT)` always (the working file is lumen's new side), `(orphaned)` appended only for a lost anchor, output `trim_end`ed with one trailing newline. Blocks are ordered by path then line. An empty store writes only the header.

## Details

### Root and store resolution

**The root comes from `initialize`, in this order:** `workspaceFolders[0].uri`, then `rootUri`, then `rootPath`. With none of them, the store falls back to `$TMPDIR/md-comment/` and the server still works for the session. One Zed project therefore shares one store, whatever repositories the files belong to.

**The server creates `<root>/.tmp/` on first write.** When `<root>/.git` exists and `<root>/.gitignore` has no line equal to `.tmp/`, it appends one. Without `.git` it touches no gitignore.

### Anchoring

**A comment anchors to a line number plus the hash of that line.** The line number locates it; the hash detects that the line moved or changed.

**While a document is open, anchors follow the edits.** For each change range in `didChange`, with `removed = end.line - start.line` and `added` the count of newlines in the replacement text:

- a comment below the change (`line - 1 > end.line`) shifts by `added - removed`;
- a comment inside the change (`start.line <= line - 1 <= end.line`) keeps its line index, clamped to the last line of the document, and its hash is recomputed from the new text — an edit to a commented line keeps its comment and re-anchors it silently;
- a comment above the change is untouched.

**On `didOpen` the hash decides.** If the stored line still hashes to the stored value, nothing happens. Otherwise the server searches for the hash within 50 lines either side of the stored line, then across the whole file, and takes the match nearest the stored line — repeated lines such as `---` therefore resolve to the closest one. With no match, the comment keeps its stored line and becomes `orphaned: true`. Any later reconcile that finds the hash again clears the flag.

**The export re-anchors before it renders.** A file edited while closed moves its lines with nobody watching, so the stored line is only trustworthy right after a reconcile. `copy comments` therefore reconciles every file in the store first — from its open buffer when it has one, else from disk — and persists whatever moved. A file that cannot be read keeps its anchors untouched, because a missing file is not evidence the text is gone.

**Deleting a commented line keeps the comment.** The change range covers it, so the comment stays at that line index and re-anchors to whatever text now occupies it. This is deliberate: a note is expensive to retype and cheap to ignore.

### Refreshing the hints

**A comment arrives without the commented file changing, so Zed has no reason to re-query inlay hints.** After every store mutation the server sends `workspace/inlayHint/refresh`, and Zed answers it by re-querying hints for that server's buffers. Without this request the hint would only appear after the next buffer edit.

### Taking the comment from the input file

**Two events drain the input file, and the server needs both.** The registered watch reports the save whether or not the file is an open buffer, which is the reliable path. `didSave` on the input path covers the case where the client reports the save but the watch never installs — a remote project, or a `file_scan_exclusions` entry covering `.tmp/`. Draining empties the file, so whichever event arrives second finds nothing and does nothing.

**A comment is anchored when it is taken, not when it is asked for.** The hash comes from the target's text at drain time — from the open buffer when there is one, else from disk — so a comment typed against a file that has since moved on still anchors to what the operator was looking at, and the usual reconcile rules take over from there.

### Self-filtering

**The server sees every markdown buffer in the project, so it filters itself.** Zed attaches a language server per language, with no per-file scoping. The server answers only for paths whose extension is `.md` or `.markdown`, and never for paths under `<root>/.tmp/`. Every other document returns `null` or an empty list.

### Crate layout

```
harness/apps/md-comment/
  Cargo.toml            # workspace root AND the extension crate (cdylib)
  extension.toml        # the Zed manifest — must sit in the directory Zed is pointed at
  src/lib.rs            # the WASM shim
  SPEC.md
  README.md             # install + the manual checklist
  server/
    Cargo.toml          # package md-comment-server, [[bin]] name = "md-comment-lsp"
                        # deps: lsp-server, serde, serde_json, sha2
    src/main.rs         # stdio loop, dispatch, effect execution
    src/lib.rs          # Session — all behaviour, no I/O loop
    src/store.rs        # load, persist, gitignore
    src/anchor.rs       # hash, position arithmetic, shift, reconcile
    src/export.rs       # lumen format
    src/wire.rs         # the LSP JSON shapes this server produces
    tests/session.rs    # protocol tests against Session
    tests/stdio.rs      # one end-to-end smoke test
```

`cargo build --target wasm32-wasip2` at the root builds the extension alone — the root
package is the default member, so Zed's build never tries to compile the server to WASM.

**`Session` holds all behaviour and does no transport.** It takes typed requests and open-document text and returns typed responses plus a list of side effects (persist, refresh, show message). The stdio loop in `main.rs` performs those effects. This is what makes the protocol tests cheap: they drive `Session` directly, with one end-to-end test over real stdio to prove the wiring.

**`lsp-server` and hand-written wire structs, not `tower-lsp` or `lsp-types`.** The server is a synchronous single-threaded loop with no concurrency to manage, and a synchronous core is deterministic under test. `wire.rs` carries the handful of JSON shapes the server emits, so the crate does not inherit `lsp-types`' churn over its URI type.

### Wiring

**`.mise.toml` gains a build task modelled on `harness:vocab:build`:**

```toml
[tasks."harness:md-comment:build"]
description = "Build the md-comment language server → ~/.local/bin/md-comment-lsp"
dir = "{{config_root}}/harness/apps/md-comment"
sources = ["server/**/*.rs", "server/Cargo.toml"]
outputs = ["{{env.HOME}}/.local/bin/md-comment-lsp"]
run = "cargo build --release -p md-comment-server && install -m 755 target/release/md-comment-lsp $HOME/.local/bin/md-comment-lsp"
```

**`.config/zed/settings.json` Markdown block gains the server and the hint flag:**

```json
"Markdown": {
  "indent_guides": { "coloring": "fixed", "enabled": true },
  "language_servers": ["marksman", "md-comment-language-server"],
  "inlay_hints": { "enabled": true, "show_other_hints": true }
}
```

**`harness/claude/commands/md-comment.md` mirrors `commands/lumen.md`.** It reads `.tmp/md-comment.md`, prints each block, treats each as a task on that file and line, and asks before changing anything the comment does not state plainly. A missing or header-only file means no comments; say so and stop.

**The extension is installed once per machine.** `zed: install dev extension` pointed at `harness/apps/md-comment` — the directory holding `extension.toml`, which is why the manifest and the shim crate sit at the app root and the server sits in `server/`. After editing the shim, `zed: rebuild dev extension`. Zed compiles the WASM itself and needs `rustup` with the `wasm32-wasip2` target. The `laptop-setup` skill records both steps.

## Before you start

Answer these before writing code:

1. Why does the `add comment` edit include a text edit as well as a create, and what happens if you send the create alone?
2. Which two events can drain the input file, and why does the server need both?
3. Which settings key decides whether the hints are visible at all, and what does the server send as the hint `kind`?
4. Where does the operator's comment text end up on disk, and which file does Claude read?
5. A commented line is deleted while the file is open. Which rule applies — shift, refresh, or orphan?
6. Why can the inlay hint not carry the delete action?

## Verification

**Protocol tests over `Session`** (`server/tests/session.rs`):

| Test | Asserts |
|---|---|
| add writes | the command hands over a header naming the target; nothing is stored until the file is drained |
| input emptied | after a drain the input file is blank, so a second save cannot duplicate the comment |
| add replaces | a second add on the same line overwrites the text, count stays 1 |
| empty body cancels | saving with nothing under the header stores nothing |
| multi-line body | a body of several lines is stored and exported whole |
| leftover input | a body left behind by a dead server is taken at startup, anchored against the file on disk |
| inlay hint | position at end of line, `💬 ` prefix, truncation at 40 with `…`, tooltip holds the full text, no `kind` |
| shift down | inserting two lines above moves the comment by two, hash unchanged |
| edit in place | editing the commented line keeps the comment and updates the hash |
| delete the line | the comment survives at that index and re-anchors |
| reconcile moved | reopening a file whose anchor moved by three lines re-anchors by hash |
| reconcile repeated | with several hash matches, the nearest to the stored line wins |
| reconcile lost | a vanished anchor sets `orphaned`, and the hint becomes `💬? ` |
| code actions | a commented line offers edit plus delete plus copy plus reset; a clean line offers add plus copy plus reset |
| export bytes | the export equals the expected string byte for byte, including the `(orphaned)` tag and block order |
| export empty | an empty store writes the header only |
| reset | `Cancel` leaves the store intact, `Delete` empties it |
| store round-trip | a store written by a previous run loads unchanged |
| filtering | `.txt` files and paths under `.tmp/` produce no hints and no actions |
| diagnostic shape | one Hint diagnostic per comment, severity 4, source `md-comment`, range covering the anchored line |
| orphan diagnostic | the message carries `(orphaned)` |
| diagnostics cleared | deleting the last comment of a file publishes an empty list once, then nothing |
| list | the export is written and the same text is handed over as a view; an empty store opens nothing |

**End-to-end smoke test** (`server/tests/stdio.rs`): spawn the binary, run `initialize` → `didOpen` → `codeAction` → `executeCommand`, answer the server's `workspace/applyEdit` and `client/registerCapability`, write the input file, notify `didChangeWatchedFiles`, then `inlayHint` — and assert the hint comes back and the input file is empty.

**Manual checklist in Zed**, six steps, recorded in the README:

1. Code actions on a markdown line list `add comment`.
2. Choosing it opens the input file with a `<!-- md-comment: <file>:<line> -->` header.
3. Type a comment and save — the markdown file is unchanged and `💬 <text>` appears at the end of the target line.
4. Code actions on that line now list `edit comment` and `delete comment`; delete removes the hint.
5. `copy comments` — the message names the path, and the file matches lumen's format.
6. `reset comments` — the confirmation appears, `Cancel` keeps the comments, `Delete` clears them.

## Known risks

- **`worktree.which` may miss `~/.local/bin`.** Zed resolves PATH from the worktree shell environment. The `$HOME/.local/bin` fallback in the shim covers it; `lsp.md-comment-language-server.binary.path` in settings is the escape hatch.
- **`marksman` is not installed on this machine.** Listing it first in `language_servers` is harmless but shows up in the Zed log as a server that never starts.
- **Truncation at 40 characters is a guess.** Adjust after the first real review pass.
- **The input file surfaces as an "LSP Edit" multibuffer, not a plain tab.** That is how the client renders a server-initiated edit; the message names the path for when the client does not surface it at all.
- **`file_scan_exclusions` would silence the watch.** `.tmp/` is not excluded by default; excluding it would stop the save ever reaching the server, leaving the startup drain as the only path.

## Glossary

- **comment** — one note the operator wrote on one markdown line. Never text in the file.
- **anchor** — the line number plus line hash that ties a comment to a place in the file.
- **orphaned** — the anchor's hash is no longer found in the file, so the comment may point at the wrong line. Kept and flagged, never deleted.
- **store** — `<root>/.tmp/md-comment.json`, the server's own state.
- **export** — `<root>/.tmp/md-comment.md`, lumen-format markdown written for Claude.
- **root** — the workspace folder Zed sent at `initialize`; one store per root.
- **input file** — `<root>/.tmp/md-comment-input.md`, where the operator types a comment. Emptied as soon as its content is stored.
- **list** — `<root>/.tmp/md-comment-list.md`, a rendered view of the export, opened by `list comments` and regenerated each time.
- **drain** — read the input file, store what it holds, empty it.
- **shim** — the Rust-to-WASM extension whose only job is telling Zed which binary to run.
