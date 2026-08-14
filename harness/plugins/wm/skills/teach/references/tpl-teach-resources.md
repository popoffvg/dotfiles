# Resources: the block workflow engine

> This file is a filled `RESOURCES.md`. Copy it to `<notes-dir>/teach/RESOURCES.md`, replace the
> content, and delete every `>` line — each one states the rule for the block above it.
> It is the curated set of trusted sources for this subject. Lesson knowledge comes from here, never
> from a guess about how such code usually works.
> Prune ruthlessly: a source that turns out stale, shallow, or off-mission is removed, not buried.
> Five sharp sources beat thirty mediocre ones.

## In-repo

- `pkg/workflow/engine.go:120` — `RenderTemplate`
  The single entry point every render passes through. Use for: anything about ordering or re-runs.
- `<notes-dir>/thoughts/007-decision-single-writer.md`
  Why the result pool has one writer. Use for: questions that start "why not just…".
- `<notes-dir>/GLOSSARY.md`
  The project's ubiquitous language. Every lesson uses these terms verbatim.

> The repo outranks everything. A claim about this code is grounded in a `file:line` or a
> `thoughts/` note — prefer both over any external write-up, including this project's own README
> when the README and the code disagree.

## External

- [Tengo language spec v2.16](https://github.com/d5/tengo/blob/v2.16.1/docs/tutorial.md)
  Use for: the exact semantics of the calls the templates make — never for how this repo uses them.

> Second-class, and only for the libraries and protocols the code depends on. Pin the version of
> every external source: library semantics change, and an unpinned link goes wrong silently.

## People (wisdom)

- @maria — wrote the result pool. Use for: which of two correct designs this team would pick.
- The PR trail on `pkg/workflow/` (`git log --follow`). Use for: what was tried and reverted.

> Annotate every entry, in every group. A bare path or link is useless in three months; one line
> saying what it covers and when to reach for it is not.
> The three groups map to knowledge and wisdom in `commands/sub-teach.md`. An entry sits in one
> group only.

## Gaps

- No written source for why re-render is not incremental. Ask @maria, then write it as a `thoughts/` note.

> Every area the mission needs where no trustworthy source exists yet. This list drives the next
> search — an empty Gaps section on a young workspace usually means nobody looked.

> **Record the human's preferences here.** Someone who does not want to be sent to a colleague has
> that noted, so later sessions stop proposing it.
