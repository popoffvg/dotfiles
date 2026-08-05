---
name: vocabulary
description: Keep the in-memory topic index current — one topic points at the one file carrying its truth. Use before writing any fact into a file (check whether a topic already has a home) and after reading any file (bind the topics it is authoritative for). Also use when a file is growing into a catch-all, when the same fact appears in two places, or when asked "where does X live", "where should this go", "is this already written down somewhere".
---

## Tools

| Tool | When |
|---|---|
| `vocab_lookup` | Before writing a fact anywhere. Before creating a file. |
| `vocab_put` | After reading a file. Accepts several entries per call. |
| `vocab_list` | To review the whole index. |
| `vocab_drop` | Only when a binding was wrong. |

The index starts empty every session and is never written to disk. It routes work inside one session.

## After reading a file

Call `vocab_put` with one entry per topic the file is authoritative for:

```
vocab_put(entries=[
  {topic: "github-repo-settings", file: "/abs/path/gh.md", purpose: "branch protection and merge rules"},
  {topic: "mise-tasks",           file: "/abs/path/.mise.toml", purpose: "stow and plugin-sync tasks"}
])
```

Rules for each field:

- `topic` — the concept, not the filename. `github-repo-settings`, not `gh-md`. Folded to lowercase kebab-case by the server.
- `file` — absolute path. Relative paths are rejected.
- `purpose` — one line naming what the file decides. A topic with no statable purpose is not a topic.

One file may hold two topics. Three is a signal: read the `warning` in the reply and split the file.

## Before writing a fact

1. `vocab_lookup` with the topic or a keyword.
2. A hit means the truth already has a home — edit that file, or reference it from the new place. Do not write a second copy.
3. A miss means the new file is the first home — write it, then `vocab_put` the topic.

## Reading the vocab_put reply

| Field | Meaning | Action |
|---|---|---|
| `status: filed` | New topic. | None. |
| `status: refiled` | Topic already existed. | None. |
| `previous_file` | The topic moved to a different file. | Confirm the old file no longer holds that truth. |
| `shared_with` | Other topics already on this file. | Two is reuse. Three or more, split. |
| `warning` | The file carries three or more topics. | Split it, one file per purpose. |
| `failed` | Entry rejected. | Fix the named field and re-file. |

## Do not

- Bind a topic to a file without reading the file.
- Invent a `purpose` to satisfy the field. Drop the entry instead.
- Use `vocab_drop` to tidy the index. Drop only wrong bindings.
- Treat the index as memory. It holds pointers, never content.
