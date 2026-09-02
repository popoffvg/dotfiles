# line-comment — implementation spec

**Goal:** review comments on a line, or on the lines a selection covers, of any file in Zed without changing the file, written from both sides — the operator through a code action, Claude through the `comment` subcommand — with `/line-comment:act` handing the operator's comments to Claude in lumen annotation format.

## Mental model

**A code action hands over an input file.** Zed exposes no LSP request that opens a text box, and a code action's command reaches only the language server, never an editor action. What a server can do is create a file through `workspace/applyEdit` — and a create carrying a text edit makes the client put that file in front of the operator. So `add comment` writes a header naming the target, and the target lines quoted under it, into `.tmp/line-comment-input-<nonce>.md`; the operator types under that and saves.

**One input file per code action, gone as soon as it is read.** The editor keeps the tab of the previous comment open on its path, so a single reused path is rewritten underneath a live buffer — which the editor reports as a conflicting change on disk and answers with an overwrite prompt. A name nothing holds open cannot conflict, so every code action mints its own and `drain` deletes the file rather than emptying it. Minting also clears away the files nobody typed into, so a cancelled comment leaves nothing behind.

**The nonce only climbs.** It starts as the millisecond the hand-over ran, but a hand-over deletes the file it replaces — so a free name on disk is no proof the name is unused, and the editor may still hold a buffer on it. The server therefore keeps the highest nonce it has given out and never goes back to one, whatever `.tmp/` looks like. `list comments` shares the counter, and both kinds are named and swept by the same code.

**A watch turns a write into a notification.** The server registers `workspace/didChangeWatchedFiles` on the input files — as the pattern `line-comment-input-*.md`, because the names are minted after the registration — and on the store, through `client/registerCapability`, so it learns of a write whether or not the file is an open buffer. The watch only reports changes while the server lives, so the server also drains the input files at startup — a comment typed before a crash is not lost.

**A comment covers a line, or the lines a selection touches.** The code action reads the range the editor sent: a cursor covers its own line, and a selection covers every line it touches — the trailing line of a whole-line selection excluded, because an editor reports those as ending at column 0 of the line after the last. The first line covered carries the anchor and addresses the comment; the last line is only the end of the block, and a comment covering one line stores no end at all. So `12` and `12-18` are the two forms the store, the input header, the export and the `comment` subcommand all name lines in.

**The comments live beside the file, never in it.** The server keeps one JSON store per Zed project under `.tmp/`. Nothing the server does writes into the commented buffer.

**Two displays carry the comments, and code actions change them.** An inlay hint sits at the end of each commented line, and the same comment is published as a `Hint` diagnostic over that line — the diagnostic is the dependable one, because it reaches the diagnostics panel whatever the hint settings say, and it renders inline when inline diagnostics are on. Zed drops the `command` field of hint label parts, so neither display can be clicked; add, edit, delete, list, copy and reset are all code actions.

**Claude reads the store through the binary, in the export format.** `line-comment-lsp list` prints every comment as lumen-format markdown, and `/line-comment:act` treats each block as a task on that file and line — then `line-comment-lsp drop <file>:<line>...` clears the ones it acted on. Reading the live store rather than a file means the comments are the ones the store holds now, and no second renderer exists to drift from the export. The `copy comments` action still writes `.tmp/line-comment.md` for anything else that wants the export as a file.

**Claude writes through the same binary, with no editor involved.** `line-comment-lsp comment <file>:<lines> <text>` loads the store, upserts an `agent` comment, and saves. The running server holds a watch on the store as well as on the input file, so it takes the write up and republishes without a restart. The watch reports no path, so the server reads the store first and drains the input second — draining first would leave its comment unpersisted and the reload would then read the file as it stood before and throw that comment away.

**The author shows in the text, not the severity.** Zed filters diagnostics by severity alone — there is no filter by `source` or by language server — so `Hint` is the one band free of real language-server traffic and both authors have to share it. An `agent` comment therefore carries `🤖` in front of its diagnostic message and `(from Claude)` on its export heading.

The whole cycle:

```
code action ──► .tmp/line-comment-input-<nonce>.md ──► save ──┐
                                                            ├─► watch ──► store (.tmp/line-comment.json)
Claude ──► line-comment-lsp comment <file>:<lines> ────────────┘             │
                                                                          │
     ┌────────────────────────────────────────────────────────────────────┘
     ├─► inlayHint   ──► 💬 hint at end of line (Markdown only)
     ├─► diagnostics ──► panel entry + inline text, 🤖 for a Claude comment
     ├─► codeAction  ──► edit / delete / list / copy / reset
     ├─► list        ──► .tmp/line-comment-list-<nonce>.md (opened)
     ├─► copy        ──► .tmp/line-comment.md
     └─► line-comment-lsp list ──► /line-comment:act ──► Claude ──► drop
```

## Not in scope

- More than one comment starting on the same line. `add comment` on a commented line replaces that comment.
- A comment on part of a line. A selection inside one line comments that whole line; the store anchors and addresses by line, and the export names lines.
- Replies, threads, resolve state, timestamps. Authorship exists, but only as `human` or `agent` on a comment.
- Comments in git. The store and the export are gitignored.
- Clipboard access. A language server cannot write the system clipboard.
- Publishing to the Zed extension marketplace. The extension stays a dev extension.
- The rename overlay as the input. It worked (a zero-width `prepareRename` range opens the box empty), but writing through a file keeps every gesture in one menu and allows a multi-line comment.
- Tasks as a comment-writing path. A language server cannot contribute a task (that channel is one vendor's `experimental.runnables`, gated by a settings key only that adapter reads), and a task template has no input or prompt field, so a task can only collect text by prompting inside a terminal.

## Invariants

1. The server never edits a commented file. Its only writes are the store file, the export file, its hand-over files under `.tmp/`, and one `.gitignore` line.
2. At most one comment exists per (file, first line covered). A comment covers `line` through `end_line`, and `end_line` is absent whenever it adds nothing to `line`.
3. A comment disappears only through `delete comment` or `reset comments`. Every other path keeps it, marked orphaned when its anchor is lost.
4. Store paths are workspace-root-relative with `/` separators.
5. Store and export line numbers are 1-based, matching lumen. LSP wire positions are 0-based; conversion happens at the protocol edge only.
6. The store file is replaced atomically: write `line-comment.json.tmp`, then rename over the target.
7. The server answers for every file type, and never for a file inside `<root>/.tmp/`.
8. A comment carries an author, `human` or `agent`. Both publish at `Hint` severity, because Zed filters diagnostics by severity and never by source.

## API anchors

### Extension shim

`harness/apps/line-comment/extension.toml`:

```toml
id = "line-comment"
name = "Line Comment"
version = "0.1.0"
schema_version = 1
description = "Review comments on lines of any file, kept outside the file"
repository = "https://github.com/popoffvg/dotfiles"
authors = ["Vitalii Popov"]

[lib]
kind = "Rust"

[language_servers.line-comment-language-server]
name = "Line Comment Language Server"
languages = ["C", "C++", "CSS", …]   # generated, see below
```

`src/lib.rs` implements one method:

```rust
fn language_server_command(&mut self, _id: &LanguageServerId, worktree: &Worktree)
    -> Result<Command>
{
    let path = worktree.which("line-comment-lsp")
        .unwrap_or_else(|| format!("{}/.local/bin/line-comment-lsp", std::env::var("HOME").unwrap()));
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
      "line-comment.add", "line-comment.list",
      "line-comment.delete", "line-comment.copy", "line-comment.reset"
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
| `textDocument/inlayHint` | One hint per comment whose first line falls inside the requested range. |
| `textDocument/codeAction` | `add comment` when no comment starts on the first line covered, titled `add comment on lines <a>-<b>` over a selection of several lines; `edit comment: <text…>` and `delete comment: <text…>` for each comment any of whose lines the range touches; `list comments`, `copy comments` and `reset comments` always. |
| `workspace/executeCommand` | The five commands below. |
| `didOpen` | Reconcile every comment of that file by hash. |
| `didChange` | Shift or refresh anchors from the change ranges. |
| `didSave` | Drain the input file when that is what was saved, else persist the store. |
| `workspace/didChangeWatchedFiles` | Reload the store, then drain the input file, in that order. |

### Diagnostic shape

```json
{
  "uri": "file:///…/docs/spec.md",
  "diagnostics": [{
    "range": { "start": { "line": 11, "character": 0 }, "end": { "line": 11, "character": 42 } },
    "severity": 4,
    "source": "line-comment",
    "message": "needs a source"        // 🤖-prefixed for an agent comment
  }]
}
```

Severity 4 is `Hint`, the quietest level, and the range covers every line the comment does — from column 0 of its first to the end of its last — so the editor marks the text the comment is about. An orphaned comment gets ` (orphaned)` appended to its message. The server publishes for every file in the store — open or not, which is what fills the diagnostics panel — and sends an **empty** list for any file it published before that now has none, because an editor keeps showing what it was last told.

### Inlay hint shape

```json
{
  "position": { "line": 11, "character": 42 },
  "label": "💬 needs a source",
  "paddingLeft": true,
  "tooltip": { "kind": "markdown", "value": "needs a source" }
}
```

`character` is the UTF-16 length of the anchored line, putting the hint at the end of the line — the first line of a span, where the block starts; the diagnostic is what shows how far the block runs. The label is `💬 ` plus the text truncated to 40 characters with a trailing `…`; an orphaned comment uses `💬? `. The hint carries **no `kind`**, which is why `Markdown.inlay_hints.show_other_hints` must be true — Zed treats a missing kind as the `None` bucket and gates it on that flag.

### Subcommands

The binary answers these before it opens the LSP channel, so Claude writes comments from a shell.

| Subcommand | Effect |
|---|---|
| `comment <file>:<lines> <text>` | Upsert an `agent` comment, hashing the first line as it reads on disk, then save the store. `<lines>` is `12` or `12-18`. |
| `drop <file>:<line>...` | Remove the comment starting on each line named. Reports every target, whether it held one or not. One session for the batch, so the store is written once and a running server reloads once. |
| `drop --all` | Remove every comment in the workspace — `reset comments`, from a shell. |
| `list` | Print the whole store in the export format. |
| `store` | Print the path of the store the commands resolved, for a caller that opens it itself. |

The root is the nearest ancestor of the target that already holds `.tmp/line-comment.json`, else the nearest ancestor holding `.git`, else the current directory — it has to match the root the server derived from `initialize`, or the two read different stores. An existing store outranks `.git` because one Zed project can hold several repositories: with `.git` first, a command run inside `<project>/pl` reads `<project>/pl/.tmp/line-comment.json` and reports no comments while the server writes them to `<project>/.tmp/line-comment.json`.

**Nothing re-implements the renderer.** `list` prints `export::render`, the same function the export file is written with, so a second copy of the format cannot drift from it — an earlier Python renderer of the store dropped the `(from Claude)` marker and left Claude acting on its own comments.

### Commands

| Command | Arguments | Effect |
|---|---|---|
| `line-comment.add` | `[uri, line, end_line]` (1-based lines; `end_line` omitted means the one line) | Write the input file for that target through `workspace/applyEdit`, so the client shows it, and name the path in a message. Also serves `edit comment`, with the existing comment's line — a line that already carries a comment gets its text under the header, so the operator changes what is there instead of retyping it. |
| `line-comment.delete` | `[uri, line]` (1-based line) | Drop that comment, persist, refresh hints. |
| `line-comment.list` | `[]` | Re-anchor, write the export, then hand over a fresh `<root>/.tmp/line-comment-list-<nonce>.md` with the same content through `workspace/applyEdit`, so the client opens it. The views already handed over are deleted first — each one renders the store as it stood, so the new one replaces them. With no comments, say so and open nothing. |
| `line-comment.copy` | `[]` | Re-anchor every comment against the file as it stands, then write the export for the whole store and `window/showMessage` (Info): `"12 comments → .tmp/line-comment.md"`. |
| `line-comment.reset` | `[]` | Ask through `window/showMessageRequest`: `"Delete 12 comments in 3 files?"` with actions `Delete` and `Cancel`. On `Delete`, clear the store, persist, refresh hints. On `Cancel` or a null reply, do nothing. |

All three return `null`; none returns a workspace edit.

### Store file

`<root>/.tmp/line-comment.json`:

```json
{
  "version": 1,
  "files": {
    "docs/spec.md": [
      { "line": 12, "hash": "9f2b1c4e7a05d381", "text": "needs a source", "orphaned": false, "author": "human" },
      { "line": 20, "end_line": 26, "hash": "0d41c8f2b17a3e95", "text": "this block repeats", "orphaned": false, "author": "human" }
    ]
  }
}
```

`hash` is the first 16 hex characters of the SHA-256 of the anchored line with trailing whitespace removed. `end_line` is the last line the comment covers and is written only when it is greater than `line`, so a single-line comment keeps the shape it had before selections and a store written by an earlier version loads unchanged. Comments are stored sorted by line, files sorted by path. An unknown `version` aborts loading with a `window/showMessage` error rather than overwriting the file.

### Input file

`<root>/.tmp/line-comment-input-<nonce>.md`, the header naming the target, the lines it aims at, then whatever the operator types:

```markdown
<!-- line-comment: docs/spec.md:12-13 -->
<!-- commenting on:
## Design
The parser reads the header first.
-->

needs a source
```

Over a selection the header names both ends — `<!-- line-comment: docs/spec.md:12-18 -->`.

**The quote is the tip, not the comment.** It holds the target lines as the file reads at hand-over — the selection, or the one line the cursor stood on — so the operator sees what the comment is about without leaving the input file, and Zed greys it out as a markdown comment. At most 10 lines are quoted, the rest counted as `… <n> more lines`; a `-->` inside the text is broken up, because it would otherwise close the block and spill the file's own text into the comment. Nothing reads the quote back: the parser drops it, and an operator who edits or deletes it changes nothing.

Parsing takes the first line containing the marker, splits the target on its **last** colon so a path may hold colons, reads what follows as `12` or `12-18`, drops a comment block standing first under the header, and treats the rest as the body, trimmed. A header naming no lines — a zero, or an end above the start — is no header at all. A block the operator never closed is text they wrote, and stays in the body. A body of several lines is kept whole — the hint shows the first 40 characters, the tooltip and the export carry all of it. Draining deletes the file, so a second save of the same content stores nothing. An empty body cancels the pending comment.

A file carrying no header is left alone: that is the empty file the code action just created, before the operator typed anything. Draining reads every input file present, so a save the watch reported late is still taken.

### Export file

`<root>/.tmp/line-comment.md`, byte-faithful to lumen's `format_annotations_for_export`:

```
# line comments

**docs/spec.md** line 12 (RIGHT)

needs a source

---

**docs/plan.md** line 3 (RIGHT) (orphaned)

this contradicts the spec

---

**docs/plan.md** lines 20-26 (RIGHT)

this block repeats
```

Rules: header line, then one block per comment joined by `---` on its own line, blank lines exactly as shown, `line <n>` for a comment on one line and `lines <a>-<b>` for one over a selection, `(RIGHT)` always (the working file is lumen's new side), `(orphaned)` appended only for a lost anchor, `(from Claude)` appended for an `agent` comment so `/line-comment:act` skips its own output, output `trim_end`ed with one trailing newline. Blocks are ordered by path then line. An empty store writes only the header.

## Details

### Root and store resolution

**The root comes from `initialize`, in this order:** `workspaceFolders[0].uri`, then `rootUri`, then `rootPath`. With none of them, the store falls back to `$TMPDIR/line-comment/` and the server still works for the session. One Zed project therefore shares one store, whatever repositories the files belong to.

**The server creates `<root>/.tmp/` on first write.** When `<root>/.git` exists and `<root>/.gitignore` has no line equal to `.tmp/`, it appends one. Without `.git` it touches no gitignore.

### Anchoring

**A comment anchors to a line number plus the hash of that line.** The line number locates it; the hash detects that the line moved or changed.

**While a document is open, anchors follow the edits.** For each change range in `didChange`, with `removed = end.line - start.line` and `added` the count of newlines in the replacement text:

- a comment below the change (`line - 1 > end.line`) shifts by `added - removed`;
- a comment inside the change (`start.line <= line - 1 <= end.line`) keeps its line index, clamped to the last line of the document, and its hash is recomputed from the new text — an edit to a commented line keeps its comment and re-anchors it silently;
- a comment above the change is untouched.

**The last line of a span closes it, so it moves by one rule of its own.** It carries no anchor, and a change reaching it pushes it by the same delta (`end_line - 1 >= change end.line`) rather than collapsing it — which is what makes a line typed inside a span part of the span, and a line deleted inside it leave the span shorter. A change that swallows the whole span leaves it on the line the change starts at. Only a span moves this way: a comment on one line never grows an end.

**A span moves whole when its first line moves.** Only that first line is hashed, so a reconcile that finds the hash elsewhere carries the number of lines covered along, and the block keeps its length wherever the anchor turns up.

**On `didOpen` the hash decides.** If the stored line still hashes to the stored value, nothing happens. Otherwise the server searches for the hash within 50 lines either side of the stored line, then across the whole file, and takes the match nearest the stored line — repeated lines such as `---` therefore resolve to the closest one. With no match, the comment keeps its stored line and becomes `orphaned: true`. Any later reconcile that finds the hash again clears the flag.

**The export re-anchors before it renders.** A file edited while closed moves its lines with nobody watching, so the stored line is only trustworthy right after a reconcile. `copy comments` therefore reconciles every file in the store first — from its open buffer when it has one, else from disk — and persists whatever moved. A file that cannot be read keeps its anchors untouched, because a missing file is not evidence the text is gone.

**Deleting a commented line keeps the comment.** The change range covers it, so the comment stays at that line index and re-anchors to whatever text now occupies it. This is deliberate: a note is expensive to retype and cheap to ignore.

### Refreshing the hints

**A comment arrives without the commented file changing, so Zed has no reason to re-query inlay hints.** After every store mutation the server sends `workspace/inlayHint/refresh`, and Zed answers it by re-querying hints for that server's buffers. Without this request the hint would only appear after the next buffer edit.

### Taking the comment from the input file

**Two events drain the input file, and the server needs both.** The registered watch reports the save whether or not the file is an open buffer, which is the reliable path. `didSave` on an input path covers the case where the client reports the save but the watch never installs — a remote project, or a `file_scan_exclusions` entry covering `.tmp/`. Draining deletes the file, so whichever event arrives second finds nothing and does nothing.

**A comment is anchored when it is taken, not when it is asked for.** The hash comes from the target's text at drain time — from the open buffer when there is one, else from disk — so a comment typed against a file that has since moved on still anchors to what the operator was looking at, and the usual reconcile rules take over from there.

### Self-filtering

**The server sees every buffer in the project, so it filters itself.** Zed attaches a language server per language, with no per-file scoping. A comment is a line annotation and no part of it depends on the language, so every file type is served — only paths under `<root>/.tmp/` are refused, which keeps a comment off the server's own input file, store and export. Every refused document returns `null` or an empty list.

**Zed has no wildcard for languages.** `[language_servers.line-comment-language-server] languages` in `extension.toml` has to name each language, so `harness/scripts/sync-line-comment-languages.py` regenerates the array from the languages installed on the machine. Re-run it after installing a language extension.

### Crate layout

```
harness/apps/line-comment/
  Cargo.toml            # workspace root AND the extension crate (cdylib)
  extension.toml        # the Zed manifest — must sit in the directory Zed is pointed at
  src/lib.rs            # the WASM shim
  SPEC.md
  README.md             # install + the manual checklist
  server/
    Cargo.toml          # package line-comment-server, [[bin]] name = "line-comment-lsp"
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

**`.mise.toml` gains a build task modelled on `harness:self-improve:build`:**

```toml
[tasks."harness:line-comment:build"]
description = "Build the line-comment language server → ~/.local/bin/line-comment-lsp"
dir = "{{config_root}}/harness/apps/line-comment"
sources = ["server/**/*.rs", "server/Cargo.toml"]
outputs = ["{{env.HOME}}/.local/bin/line-comment-lsp"]
run = "cargo build --release -p line-comment-server && install -m 755 target/release/line-comment-lsp $HOME/.local/bin/line-comment-lsp"
```

**`.config/zed/settings.json` Markdown block gains the server and the hint flag:**

```json
"Markdown": {
  "indent_guides": { "coloring": "fixed", "enabled": true },
  "language_servers": ["marksman", "line-comment-language-server"],
  "inlay_hints": { "enabled": true, "show_other_hints": true }
}
```

**`harness/plugins/line-comment/commands/act.md` mirrors `commands/lumen.md`.** It runs `line-comment-lsp list`, prints each block, treats each as a task on that file and line, and asks before changing anything the comment does not state plainly. Header-only output means no comments; say so and stop. A block marked `(from Claude)` is its own and it acts on none of it. The edits themselves happen in fork agents, one per file so two agents never write the same file, spawned in one message; the session that read the store keeps the grilling, the drop and the report. Every comment it acted on goes in one `line-comment-lsp drop <file>:<line>...`; the running server clears the hints through its watch on the store, with no restart.

**The extension is installed once per machine.** `zed: install dev extension` pointed at `harness/apps/line-comment` — the directory holding `extension.toml`, which is why the manifest and the shim crate sit at the app root and the server sits in `server/`. After editing the shim, `zed: rebuild dev extension`. Zed compiles the WASM itself and needs `rustup` with the `wasm32-wasip2` target. The `laptop-setup` skill records both steps.

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
| diagnostic shape | one Hint diagnostic per comment, severity 4, source `line-comment`, range covering the anchored line |
| orphan diagnostic | the message carries `(orphaned)` |
| diagnostics cleared | deleting the last comment of a file publishes an empty list once, then nothing |
| list | the export is written and the same text is handed over as a view; an empty store opens nothing |

**End-to-end smoke test** (`server/tests/stdio.rs`): spawn the binary, run `initialize` → `didOpen` → `codeAction` → `executeCommand`, answer the server's `workspace/applyEdit` and `client/registerCapability`, write the input file, notify `didChangeWatchedFiles`, then `inlayHint` — and assert the hint comes back and the input file is empty.

**Manual checklist in Zed**, seven steps, recorded in the README:

1. Code actions on a markdown line list `add comment`.
2. Choosing it opens the input file with a `<!-- line-comment: <file>:<line> -->` header and the target line quoted under it.
3. Type a comment and save — the markdown file is unchanged and `💬 <text>` appears at the end of the target line.
4. Code actions on that line now list `edit comment` and `delete comment`; delete removes the hint.
5. With several lines selected the menu lists `add comment on lines <a>-<b>`, the export names `lines <a>-<b>`, and the diagnostic underlines all of them.
6. `copy comments` — the message names the path, and the file matches lumen's format.
7. `reset comments` — the confirmation appears, `Cancel` keeps the comments, `Delete` clears them.

## Known risks

- **`worktree.which` may miss `~/.local/bin`.** Zed resolves PATH from the worktree shell environment. The `$HOME/.local/bin` fallback in the shim covers it; `lsp.line-comment-language-server.binary.path` in settings is the escape hatch.
- **`marksman` is not installed on this machine.** Listing it first in `language_servers` is harmless but shows up in the Zed log as a server that never starts.
- **Truncation at 40 characters is a guess.** Adjust after the first real review pass.
- **The input file surfaces as an "LSP Edit" multibuffer, not a plain tab.** That is how the client renders a server-initiated edit; the message names the path for when the client does not surface it at all.
- **`file_scan_exclusions` would silence the watch.** `.tmp/` is not excluded by default; excluding it would stop the save ever reaching the server, leaving the startup drain as the only path.

## Glossary

- **comment** — one note the operator wrote on a line, or on the lines a selection covered. Never text in the file.
- **span** — the lines a comment covers, `line` through `end_line`. Written `12` or `12-18` wherever lines are named, and `lines 12-18` in the export.
- **anchor** — the line number plus line hash that ties a comment to a place in the file. Always the first line of a span.
- **orphaned** — the anchor's hash is no longer found in the file, so the comment may point at the wrong line. Kept and flagged, never deleted.
- **store** — `<root>/.tmp/line-comment.json`, the server's own state.
- **export** — `<root>/.tmp/line-comment.md`, lumen-format markdown written for Claude.
- **root** — the workspace folder Zed sent at `initialize`; one store per root.
- **input file** — `<root>/.tmp/line-comment-input-<nonce>.md`, where the operator types a comment. One per code action, deleted as soon as its content is stored.
- **list** — `<root>/.tmp/line-comment-list-<nonce>.md`, a rendered view of the export, opened by `list comments`. One per run; the earlier ones are deleted when the next is handed over.
- **hand-over** — a file the server puts in front of the operator: an input file or a list view. One path per hand-over, deleted once spent, because a reused path is one the editor still holds a buffer on.
- **drain** — read the input files, store what they hold, delete them.
- **shim** — the Rust-to-WASM extension whose only job is telling Zed which binary to run.
