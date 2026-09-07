---
name: edit-the-source-unit-not-the-render
description: Use before editing a prose document that may be assembled from smaller source units — a spec, README, decisions doc, changelog, status page, or API reference in a repo that also holds a templates/, atoms/, adr/, fragments/, or partials/ directory. Check for a template with placeholders and edit the source unit instead; a direct edit to the rendered file is silently overwritten on the next render. Triggers on "add X to the spec/README/docs", "update the decisions doc", "put this in implementation.md".
metadata:
  origin: self-improvement
---

# Edit the unit the doc is rendered from

Find the source before you edit the prose. A rendered document looks hand-written — full
sentences, no markers, tracked in git — and an edit to it survives review, lands in a commit, and
disappears the next time anyone renders. Nothing warns you.

## Procedure

1. **Look for the render inputs** next to the document, before opening it to edit:
   - a sibling `templates/`, `atoms/`, `fragments/`, `partials/`, `adr/`, `_includes/` directory
   - a file with the same basename plus a template extension (`X.tmpl.md`, `X.md.j2`, `X.in`)
   - a header line like `generated <date>`, or a `Makefile` / script naming the document
2. **Confirm by matching text.** Open the template and check the document's paragraphs appear as
   placeholders there (`{{ID}}`, `{% include %}`, `@import`). If the document's own words are
   inside a smaller file elsewhere, that smaller file is the edit target.
3. **Edit the source unit; render or let the pipeline render.** Never edit both — the render
   overwrites your copy and the two texts diverge until someone notices.
4. **When the change needs a new unit, follow the corpus's own rules for adding one**: its id
   scheme, its status field, its template. Pick the next unused id by grepping the whole repo for
   the candidate, not by incrementing the highest filename — ids get reserved before files exist.
5. **Adding a unit to a human-owned corpus is the author's call, not yours.** Create it in the
   corpus's pending/staging state and say it needs their acceptance; do not mark it accepted, and
   do not wire it into the template's render list without asking.

## Trap

Concluding "the docs live in `implementation.md`" from a directory listing. The listing shows the
render; the template beside it shows who writes it. One `ls` of the sibling directories costs
nothing and saves an edit that evaporates.

## Related

`stale-artifacts-before-red` — the same derived-vs-source confusion for build outputs.
`source-doc-over-derived-spec` — which document to read when both a source and a derived spec exist.
`unit-must-not-be-derivable` — whether the corpus needs a new unit at all.
