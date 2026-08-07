# vocab-mcp

MCP server holding a topic index in memory: one **topic** points at the one **file** that carries the truth for it, plus a one-line **purpose**.

Claude Code spawns one process per session over stdio. The index starts empty and dies with the session. Nothing is written to disk.

## Build

```sh
mise run harness:vocab:build   # → ~/.local/bin/vocab-mcp
mise run harness:vocab:test    # go test ./... -race
```

The plugin at `harness/plugins/vocab/` registers this binary by name, so `~/.local/bin` must be on PATH.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `vocab_put` | `entries: [{topic, file, purpose}]` | Per entry: `status`, `previous_file`, `shared_with`, `warning` |
| `vocab_lookup` | `query` (optional) | Entries matching topic, purpose, or file path |
| `vocab_list` | none | Every entry, ordered by topic |
| `vocab_drop` | `topic` | Confirmation, or an error for an unknown topic |

## Layers

| Path | Holds |
|---|---|
| `internal/vocabulary` | `Entry` and `Vocabulary`. All rules. No MCP types. |
| `internal/mcpserver` | Tool schemas, argument parsing, DTO mapping. No rules. |
| `cmd/vocab-mcp` | stdio wiring and `--version`. |

`Entry` enforces its invariants in `NewEntry`: a normalized non-empty topic, an absolute file path, a non-empty purpose. An invalid `Entry` cannot be constructed.

## Behavior worth knowing

- **Topics fold.** `GitHub Repo`, `github_repo`, and `github-repo` are one entry, not three.
- **Refiling a topic replaces its file** and reports `previous_file` when the path changed.
- **`shared_with` names the other topics on the same file.** Two topics on one file is reuse. At three, `vocab_put` returns a `warning` to split the file — this is the signal against one file absorbing everything.
- **A partly valid batch still files.** Valid entries land in `filed`, rejected ones in `failed` with the reason. Only a batch where every entry fails is a tool error.
