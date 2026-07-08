---
name: prune-text
description: This skill should be used when the user asks to "dedup the docs", "prune the corpus", "remove duplicate/redundant paragraphs", "reduce duplication across files", "these files repeat the same information", "consolidate repeated content", "the corpus duplicates topics", "map topics across files", or wants to find and remove duplicated prose across a set of text files (plain prose, markdown, SKILL.md, references, commands, specs).
user-invocable: true
---

# Dedup a doc corpus

Remove repeated prose across a set of text files without losing signal. Four steps: map → cross-reference → classify → rewire. Never cut before classifying — some duplication is load-bearing. Works on any prose corpus; markdown-specific signals (frontmatter, sync hooks) apply only when present.

## Step 1 — Topic map

For every file, walk top to bottom and emit ONE line per paragraph naming its subject (≤10 words), preserving order and numbering paragraphs per file:

```
### <path>
1. <topic>
2. <topic>
```

Name the *subject*, not a summary — subjects are what collide across files. For a large corpus (>~8 files), fan out parallel read-only agents, each mapping a batch, same output format. Reading whole files into one context to map them wastes context; delegate.

## Step 2 — Cross-reference

Group topics appearing in 2+ files. Output a table per group: the topic, the files+paragraphs that carry it, and a candidate **owner** (the file whose job that topic is). Include the file's own frontmatter/description if it restates a listed topic.

## Step 3 — Classify each group (do NOT skip)

Three kinds — only one is debt to cut:

| Kind | Signal | Verdict |
|---|---|---|
| **Required copy** | A hook/tool keeps two copies verbatim in sync; a table mirrored by convention; a worked example reused as illustration | **Keep.** Cutting it fights the sync mechanism or removes a teaching instance. |
| **Cross-cutting rule restated per file** | The same rule ("commit after tests", "log to X", "read-only") re-stated in many sibling files | **Collapse** into one shared reference; each file cites it once. |
| **Owner + re-derivation** | One file owns the spec; another re-teaches it inline instead of pointing | **Point.** Delete the inline copy, cite the owner. |

Check the repo for signals before deciding: a pre-commit sync hook, a CLAUDE.md note that a copy is deliberate, a `*-help` command holding a second table copy. Those mark **required copies** — leave them.

## Step 4 — Rewire

- **Collapse:** create one shared reference (e.g. `references/ref-<topic>-rules.md`); each sibling drops the restatement and leaves ONE line: `See ref-<topic>-rules.md.`
- **Point:** delete the inline copy; cite the owner by its relative slug.
- **Preserve the delta:** when a file both restates a rule AND adds something unique, cut only the restatement — keep the unique part, then cite the owner for the rest.
- **Owner picks itself:** the file whose named responsibility is that topic. Others reference it, never the reverse.

## Non-obvious rules

- **Classify before cutting.** The first instinct — "same words twice, delete one" — destroys required copies and worked examples.
- **A worked example is not duplication.** The same scenario shown as a flow, a decision note, and a test is deliberate; each shows a different facet.
- **Frontmatter descriptions count** as a copy of the topic list — include them in the map, but they're usually required (they drive routing/triggering).
- **One-line pointers, not paragraphs.** A pointer that re-summarizes the owner is just duplication with extra steps.

## Verify

Grep every `see <slug>` / `See <file>` pointer and confirm each resolves to an existing file. A dangling pointer is worse than the duplication it replaced. Confirm each collapsed file cites the shared reference exactly once. Report files touched with a one-line change each, and paste the grep proving no dangling pointers.
