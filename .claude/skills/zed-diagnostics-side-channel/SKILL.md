---
name: zed-diagnostics-side-channel
description: Use when designing or extending a language server that pushes non-error information into Zed — agent comments, review notes, annotations, status — or when choosing a diagnostic severity so the extra output does not drown the real language server. Trigger on "LSP that shows comments inline", "publish annotations as diagnostics", "filter out my server's diagnostics", "hide these from the problems panel", or work on harness/apps/md-comment.
user-invocable: false
metadata:
  origin: self-improvement
---

# Side-channel diagnostics in Zed

**Publish side-channel diagnostics at `Hint` severity.** Severity is the only band Zed can
filter on, and real language servers almost never emit `Hint`, so `Hint` is the one channel
that does not collide with compiler output.

## Zed cannot filter by source

No setting selects diagnostics by their `source` field or by which language server produced
them ([zed.dev/docs/diagnostics](https://zed.dev/docs/diagnostics)). Source-aware filtering is
a proposal, not a feature ([discussion #48786](https://github.com/zed-industries/zed/discussions/48786)).
The only per-server control is whole-server on/off through the `language_servers` array with a
`!` prefix ([configuring-languages](https://zed.dev/docs/configuring-languages)).

What severity filtering exists:

| Surface | Key | Values |
|---|---|---|
| Inline end-of-line text | `diagnostics.inline.max_severity` | `off` `error` `warning` `info` `hint` `null` |
| Whole editor | `diagnostics_max_severity` | same |
| Tab badges | `tabs.show_diagnostics` | `off` `errors` `all` |
| Project panel badges | `project_panel.show_diagnostics` | `off` `errors` `all` |
| Scrollbar marks | `scrollbar.diagnostics` | `none` `error` `warning` `information` `all` |

## Settings the channel needs

`~/.config/zed/settings.json` already carries the pair that makes `Hint` visible inline while
keeping it off the tab badges:

```json
"diagnostics": { "inline": { "enabled": true, "max_severity": "hint" } },
"tabs": { "show_diagnostics": "errors" }
```

Diagnostics settings are editor-wide, not per-language — a per-language block cannot turn the
inline text on for one file type only.

## Distinguish authors inside the message

Two writers sharing one severity band cannot be told apart by severity. Prefix the diagnostic
message instead (`🤖 …` for agent-authored, plain for human).

## Registering the server for every language

`extension.toml` has no wildcard. `[language_servers.NAME] languages = [...]` takes an explicit
list, and each entry must match the `name` field of a language's `config.toml`
([extensions/languages](https://zed.dev/docs/extensions/languages)). `language_ids` only maps
those names to LSP `languageId` strings — it is not a catch-all. An empty array is legal
(`#[serde(default)]` on `LanguageServerManifestEntry.languages`) and means the server attaches
to nothing.

**Generate the array from the machine, do not hand-write it.** Zed compiles in only ~20
languages — the `name` of each `config.toml` under `crates/grammars/src/` in
zed-industries/zed. Everything else arrives as an installed extension, so the set differs per
machine and grows whenever the user installs one. Read the installed names from
`~/Library/Application Support/Zed/extensions/installed/*/languages/*/config.toml` (or
`$XDG_DATA_HOME/zed/…` on Linux), union them with the built-ins, and rewrite the array.
`harness/scripts/sync-md-comment-languages.py` does exactly this; re-run it after installing a
language extension, then `zed: rebuild dev extension`.

Do not go looking for the language list under `crates/languages/src/` — that directory holds
only the ~16 adapter `.rs` files, not the language configs.

## The server already exists

`harness/apps/md-comment` publishes stored comments as `Hint` diagnostics plus inlay hints,
with a JSON store at `<root>/.tmp/md-comment.json` and re-anchoring in `server/src/anchor.rs`.
Extend it rather than adding a second server — a second server on the same file competes for
the same `Hint` band with no way to filter one out.
