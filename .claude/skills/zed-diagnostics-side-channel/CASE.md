# Cases

## 2026-08-10 — Zed's language set is per-machine, so the `languages` array has to be generated

- **Repo:** `/Users/vitaliipopov/git/dotfiles`
- **Source:** discovery — excavating where Zed keeps its language names, after the user asked for the server to cover "any filetype and languages"
- **Task:** widening md-comment's `extension.toml` from `languages = ["Markdown"]` to every language.
- **What I did:** assumed Zed carried a large built-in language table I could copy once into the array, and went looking for it under `crates/languages/src/` in zed-industries/zed.
- **User's words:**
  > I want for any filetep and languages

  What settled it — `crates/languages/src/` holds only 16 adapter `.rs` files (GitHub contents API); the language configs are `crates/grammars/src/*/config.toml`, and there are only 22, three of which are injected sub-languages (`Markdown-Inline`, `JSDoc`, `Regex`). Every other language is an installed extension: `~/Library/Application Support/Zed/extensions/installed/*/languages/*/config.toml` yielded 15 more on this machine, including the user's own Tengo.
- **Evidence:** `harness/scripts/sync-md-comment-languages.py` run output — "wrote 34 languages to harness/apps/md-comment/extension.toml", where 18 are built-in and 16 came from installed extensions. `extension_manifest.rs:337` shows `languages: Vec<LanguageName>` with `#[serde(default)]`, so an empty array is legal and silently attaches to nothing.
- **Ambiguous?** no — the set differs per machine and grows on every extension install, so a hand-written list is wrong the moment the user installs a language.
- **Scope chosen:** project:`/Users/vitaliipopov/git/dotfiles` — same skill, same repo. Extends the existing rule rather than forking.
- **Rule written:** verdict — generate the `languages` array from the built-in grammars plus the installed extensions' `config.toml` files; never hand-write it, and do not look for the list under `crates/languages/src/`.
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-zed-language-list-is-per-machine-e16b45b6-405d-4af4-85ad-27b462c5965a.jsonl`
- **Session topic:** writing a Zed LSP that surfaces model-authored inline comments as diagnostics

## 2026-08-10 — Zed has no per-source diagnostic filter, so `Hint` is the only free channel

- **Repo:** `/Users/vitaliipopov/git/dotfiles`
- **Source:** discovery — reading Zed docs to answer "could zed filter diagnostic somehow?"
- **Task:** planning an LSP that lets the model attach comments to code lines in Zed, shown through diagnostics.
- **What I did:** assumed Zed could filter diagnostics by their `source` field or by originating language server, which would have let a side-channel server use any severity it liked.
- **User's words:**
  > write lsp for zed that allows model to share with me some comment inlining in code. For that it should provide diagnostics. First, could zed filter diagnostic somehow?

  Docs passage that settled it — [zed.dev/docs/diagnostics](https://zed.dev/docs/diagnostics) lists only severity keys (`diagnostics_max_severity`, `diagnostics.inline.max_severity`, `tabs.show_diagnostics`, `project_panel.show_diagnostics`, `scrollbar.diagnostics`) and no `source` key; [discussion #48786](https://github.com/zed-industries/zed/discussions/48786) shows source attribution is still a proposal.
- **Evidence:** `~/.config/zed/settings.json:13` (`"tabs": {"show_diagnostics": "errors"}`) and `:62-66` (`"diagnostics": {"inline": {"enabled": true, "max_severity": "hint"}}`) — the existing config already encodes the workaround, with a comment naming md-comment as the reason. `harness/apps/md-comment/README.md` states the same pairing.
- **Ambiguous?** no — severity is the only filterable axis, and `Hint` is the only band real language servers leave empty.
- **Scope chosen:** project:`/Users/vitaliipopov/git/dotfiles` — Step 1 row 2. The rule is anchored to concrete Zed setting keys and to `harness/apps/md-comment`, which lives only in this repo. If a second repo ever grows an editor side-channel server, promote to global.
- **Rule written:** verdict — publish side-channel diagnostics at `Hint` severity, because Zed can filter only by severity and never by source or server.
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-zed-diagnostics-side-channel-e16b45b6-405d-4af4-85ad-27b462c5965a.jsonl`
- **Session topic:** writing a Zed LSP that surfaces model-authored inline comments as diagnostics
