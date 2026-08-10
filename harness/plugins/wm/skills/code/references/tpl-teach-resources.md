# template — teach RESOURCES.md

`RESOURCES.md` sits at `<notes-dir>/teach/RESOURCES.md`. It is the curated set of trusted sources for
this subject. Lesson knowledge is drawn from here, never from parametric guesses about how such code
usually works. Used by `sub-teach.md`.

For a codebase the first-class source is the repo itself. External documentation is second, and only
for the libraries and protocols the code depends on.

## Structure

```md
# Resources: {the subsystem, package, or change}

## In-repo

- `path/to/entry.ts:120` — `handleRequest`
  The single entry point every request passes through. Use for: anything about ordering or retries.
- `<notes-dir>/thoughts/007-decision-single-writer.md`
  Why the writer is single-threaded. Use for: questions that start "why not just…".
- `<notes-dir>/GLOSSARY.md`
  The project's ubiquitous language. Every lesson uses these terms verbatim.

## External

- [Library docs: {name} v{version}]({url})
  Use for: the exact semantics of the API the code calls — not for how the code uses it.

## People (wisdom)

- {name or handle} — wrote the {area}. Use for: which of two correct designs this team would pick.
- The PR trail on `{path}` (`git log --follow`). Use for: what was tried and reverted.

## Gaps

- {An area the mission needs where no trustworthy source exists yet}
```

## Rules

- **The repo outranks everything.** A claim about this code is grounded in a `file:line` or a
  `thoughts/` note. Prefer them over any external write-up, including the project's own README when
  the README and the code disagree.
- **Pin the version of every external source.** Library semantics change; an unpinned doc link
  becomes wrong silently.
- **Annotate every entry.** A bare path or link is useless in three months. One line: what it covers
  and when to reach for it.
- **Group by In-repo / External / People.** The three groups map to knowledge and wisdom in
  `sub-teach.md`. An entry may sit in one group only.
- **Surface gaps explicitly.** No trustworthy source for an area the mission needs → list it under
  `## Gaps`. That list drives the next search.
- **Prune ruthlessly.** A source that turned out stale, shallow, or off-mission is removed, not
  buried. Five sharp sources beat thirty mediocre ones.
- **Record preferences.** The human who does not want to be sent to a colleague has that noted here,
  so later sessions stop proposing it.
