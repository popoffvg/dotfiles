---
name: rules-file-conventions
description: >
  Use when writing or editing an always-loaded rules file — a CLAUDE.md, or any other file the
  harness injects into every session — or
  when writing a cross-skill pointer inside one. Owns the two conventions those files carry;
  general prose shape lives in `text-style`.
metadata:
  origin: self-improvement
---

# rules-file-conventions

**Wrap every section in a `<when>` gate.** State the situation it applies in — one gate per
section, no untagged section. A prose lead-in like `**Use when …**` is not the accepted form.
Live example: `harness/claude/CLAUDE.md` — one gate per section.

**Point, don't wikilink.** Cite another skill or file with a normal Markdown link
(`[slug](../slug/SKILL.md)`) or an `@file` reference — never a `[[wikilink]]`. Nothing in the
Claude Code corpus resolves one.

