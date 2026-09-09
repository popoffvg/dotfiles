# Resources: the block workflow engine

> A filled `<notes-dir>/teach/RESOURCES.md`. Copy the file, replace the content, delete the `>`
> lines — each one states the rules for the piece above it.
> It is the curated set of trusted sources for this subject. Lesson knowledge comes from here, never
> from a guess about how such code usually works.
> Source selection follows `teach:commands/sub-teach.md` § Knowledge, skills, wisdom.

## In-repo

- `pkg/workflow/engine.go:120` — `RenderTemplate`
  The single entry point every render passes through. Use for: anything about ordering or re-runs.
- `<notes-dir>/thoughts/007-decision-single-writer.md`
  Why the result pool has one writer. Use for: questions that start "why not just…".
- `<notes-dir>/GLOSSARY.md`
  The project's ubiquitous language. Every lesson uses these terms verbatim.

> In-repo sources ground code claims; precedence is `teach:commands/sub-teach.md` § Knowledge,
> skills, wisdom.

## External

- [Tengo language spec v2.16](https://github.com/d5/tengo/blob/v2.16.1/docs/tutorial.md)
  Use for: the exact semantics of the calls the templates make — never for how this repo uses them.

> External sources cover dependencies; pin their versions.

## People (wisdom)

- @maria — wrote the result pool. Use for: which of two correct designs this team would pick.
- The PR trail on `pkg/workflow/` (`git log --follow`). Use for: what was tried and reverted.

> Annotate each source with what it covers and when to use it. Grouping rules:
> `teach:commands/sub-teach.md` § Knowledge, skills, wisdom.

## Gaps

- No written source for why re-render is not incremental. Ask @maria, then write it as a `thoughts/` note.

> List mission-relevant areas with no trustworthy source yet.
