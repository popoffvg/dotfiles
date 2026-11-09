---
name: terms
description: >-
  Common glossary creation, maintenance, and terminology alignment for every
  skill. Use when a caller needs domain terms recorded, definitions updated,
  synonyms merged, collisions resolved, or a glossary checked. Owns the shared
  CONTEXT-FORMAT.md.
---

# Terms

Own glossary creation, updates, terminology alignment, and the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md). Other skills load `terms` for glossary work and keep their workflow-specific review gates.

Use the caller's glossary path; inside WM it is `<notes-dir>/GLOSSARY.md`. For a new glossary, start with the template's context heading and add entries as terms are resolved. For an existing glossary, preserve unchanged entries and its established meanings.

For extraction or alignment, return **glossary**, **synonyms + removal proposals**, and **rename suggestions**. For a targeted update, apply only the requested change. Write to disk when the user or calling skill supplies the glossary path.

## Collect sources

Take the source set from the caller (a dir, a glob, a file list, a repo). If none named, ask once, then default to the current dir's markdown + code-comment text.

Read each source for terms that name a domain concept: nouns and noun phrases for entities, states, roles, actions, events. Skip generic engineering words (config, handler, util) unless the domain gives them a specific meaning.

Record for each hit: the term as written, the source path, and a one-line gloss inferred from surrounding text.

## Cluster and canonicalize

Group hits that name the same concept — spelling/case/number variants (`Order`/`orders`), abbreviations (`PR`/`pull request`), and true synonyms (`cancel`/`abort`/`void`).

For each cluster pick one **canonical** term:
- Most frequent across sources, tie-break to the clearest and least overloaded.
- Prefer the term already used in the highest-authority source (spec > docs > code comments).

Flag a term used for two different concepts (**collision**) separately from synonyms — a collision needs splitting, not merging.

## Report

**Glossary** — use the format above for both chat and file output; do not substitute a term table. Record source paths in each entry's Source field. Keep occurrence counts in the analysis for ranking proposals.

**Synonyms + removal proposals** — one row per non-canonical variant:

| Variant | Canonical | Variant type | Proposal |
|---------|-----------|--------------|----------|

`Variant type` is `spelling` / `abbrev` / `synonym` / `collision`. `Proposal`:
- synonym/spelling/abbrev → `replace with <canonical>` and name the files to edit.
- collision → `split: <term> means A in <src>, B in <src> — rename one`.

Rank proposals by occurrence count (highest churn saved first). Propose only; do not edit sources unless asked.

**Rename suggestions** — sharpen the naming itself, beyond merge/split. One row per term worth renaming:

| Term | Suggested | Reason |
|------|-----------|--------|

Three drivers:
- **Vague/overloaded** → a more concrete name. `account` → `Customer` or `User` (name which concept each site means). Propose the specific term the usage actually points at, not a generic one.
- **Looks-alike, means-different** → distinct names so the pair stops reading as the same thing. When two terms are near-homographs (`update` vs `upsert`, `owner` vs `assignee`) yet name different concepts, propose renaming one so the difference is visible at a glance.
- **Jargon/metaphor** → plain business language. Replace coined, metaphorical, or insider terms with the everyday word for the concept: `north star` → `goal`, `atom` → `requirement`, `ubiquitous language` → `glossary`. Prefer the word a domain expert would use in a meeting over one the team invented.

Do not fold these into synonyms — a rename keeps the concept, changes the word; a synonym removal drops a duplicate word for the same concept.

## Rules

- Evidence over guess: every term cites at least one source path. No source, no entry.
- One concept, one canonical term — but keep collisions as distinct concepts, never fold them together.
- Definitions are glossary-only: what the concept means, not how it is built.
