---
name: rules-file-conventions
description: >
  Use when writing or editing an always-loaded rules file — a CLAUDE.md, an output style under
  `harness/claude/output-styles/`, or any other file the harness injects into every session — or
  when writing a cross-skill pointer inside one. Owns the two conventions those files carry;
  general prose shape lives in `text-style`.
metadata:
  origin: self-improvement
---

# rules-file-conventions

**Wrap every section in a `<when>` gate.** State the situation it applies in — one gate per
section, no untagged section. A prose lead-in like `**Use when …**` is not the accepted form.
Live examples: `harness/claude/CLAUDE.md:5`, `harness/claude/output-styles/CODE_STYLE.md` (gates
at lines ~5, 9, 28), `output-styles/STYLE.md` (~7, 25).

**Point, don't wikilink.** Cite another skill or file with a normal Markdown link
(`[slug](../slug/SKILL.md)`) or an `@file` reference — never a `[[wikilink]]`. Nothing in the
Claude Code corpus resolves one.

See `CASE.md` for the sessions that forced both rules.
