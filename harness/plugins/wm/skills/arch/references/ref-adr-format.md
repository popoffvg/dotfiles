# arch — ADR format in a wm corpus

**A decision of the wm flow is an ADR in `<notes-dir>/adr/`.** The `adr` skill owns the authoring procedure: collect, classify, merge, interview, draft, ask, and the title rules. This file holds only what a wm corpus adds to it. The filled ADR with its rules as `>` blocks: [`examples/adr.md`](../examples/adr.md).

## Location and archive

```
<notes-dir>/adr/
  NNNN-slug.md
  gates/
    NNNN-slug.md   # the Property gate rows of the ADR, same file name
  archived/
    NNNN-slug.md   # deprecated or superseded, same file name
    gates/
      NNNN-slug.md
```

- `NNNN` is a 4-digit number: the highest number in `adr/` and `adr/archived/`, plus one. A number is never reused.
- The slug comes from the title.
- A file in `adr/` is live and binds the code; a file in `adr/archived/` is dropped. Its `status` says whether the operator approved it (§ Status).
- The `adr-archive.sh` hook moves a live ADR to `adr/archived/`, and its gate file to `adr/archived/gates/`, when the last line of its changelog starts with `Superseded by [ADR-NNNN]` or `Deprecated:`. Do not move the file yourself, and never delete it. The hook prints the live ADRs that still link to the moved one; repoint each link at the replacement.

## Frontmatter

```yaml
---
kind: architecture        # architecture | feature
status: approved          # proposed | approved — only the operator writes this line
created: 2026-06-18
updated: 2026-06-18
source: human             # optional: auto | human
---
```

- `kind` is `architecture` or `feature`, as the `adr` skill defines them. An ADR names no TODO and carries no `todo:` key: a choice inside one TODO is tactical, and the `adr` skill sends it to the TODO (`commands/sub-todo.md` § Implementation decisions). `wm-constraints.py --check` fails a `todo:` key.
- `source: auto` means the code or a research artifact forced the choice and nobody was asked. The provenance line of its `## Reason` says `Decided by the code` and cites the `file:line` or the research file. A reviewer reads `auto` ADRs first.

## Status

An ADR status is `proposed` or `approved`. A missing `status` key reads as `proposed`.

- An agent MUST NOT change or delete the `status` line. A new ADR gets `status: proposed` from the template. The operator sets `approved` in the editor after reading the ADR. The `adr-status-guard.py` hook blocks an agent edit that changes the status.
- An agent MUST NOT edit an approved ADR. To refine, supersede, or deprecate one, ask the operator to set it back to `proposed` first. The hook blocks the edit until then.
- No TODO is implemented while a live ADR is `proposed`. `~/.claude/scripts/wm-constraints.py <notes-dir>/adr --unapproved` lists them and exits 4. `impl` step 2, the `wm-code-impl` workflow, and the `spec.md` → `status: impl` gate in `guard.sh` all stop on it.
- A `proposed` ADR still gives its rules: the rule table marks them `[proposed]`.

## Properties are the rules

Each Property of a live ADR is one rule, id `ADR-NNNN/Pn`, text = the `Property` cell of its table row verbatim. `wm-constraints.py` prints the rules (`ref-todo-sections.md` § Constraints).

**Properties are never renumbered, and a number is never reused.** A dropped Property leaves the table; the changelog line names its number and the reason, so an old citation still resolves through the history. The table keeps the gap.

## An open question is a section of QUESTIONS.md

The rule and the format are in the Open questions part of the `adr` skill's `ADR-FORMAT.md`. In the wm flow the section is `## <slug>` in `<notes-dir>/QUESTIONS.md`, and the filled file is [`examples/questions.md`](../examples/questions.md). Write it the moment the question surfaces: from the request, from a research gap, or mid-grill.

**Answer a question:**

1. A strategic answer: write the ADR with the `adr` skill, after the operator approves it. Its paragraph and `## Reason` carry the answer. A tactical answer — where a package lives, a name, a value — is never an ADR: write it in `spec.md`, the TODO, or `PATTERNS.md`.
2. Delete the section from `QUESTIONS.md`. The jj history keeps it.
3. A question that stops mattering is deleted too; the commit message gives the reason.

## Refine in place, reverse by supersede

A change that keeps the chosen option is a refinement. A change of the chosen option is a reversal.

| Change | Action |
|---|---|
| Add or refine a Property | Edit the ADR and its gate row. Bump `updated`, append a changelog line. |
| Drop a Property | Delete its row and its gate row, and name it in the changelog line (§ Properties are the rules). |
| Reverse the decision | First write a new ADR that names the old one in its opening paragraph. Then bump `updated` on the old one and append the changelog line `Superseded by [ADR-NNNN](../NNNN-slug.md)`. The hook archives it. |
| Drop the decision, nothing replaces it | Bump `updated` and append the changelog line `Deprecated: <reason>`. The hook archives it. |
| Rename a term | Run `~/.claude/scripts/rename-token.sh`. |

## Facts live in research

A fact goes into the research artifact in `<notes-dir>/research/` that established it, with its source. An ADR that rests on a fact cites that research file in its paragraph or its Reason.

## Links

Cite another ADR with a markdown link: `[ADR-0003](0003-slug.md)`. From `adr/`, a research file is `[token TTL](../research/token-ttl.md)`. The `tracer` agent walks these links and the changelog, with its `Superseded by` line.

## Find the ADRs for a task

**Read the metadata first, then open only the ADRs that bear on the task.** Never read the ADR directory file by file.

```bash
~/.claude/scripts/wm-adr-index.py <notes-dir>/adr                  # every live ADR: number, kind, title, path
~/.claude/scripts/wm-adr-index.py <notes-dir>/adr -m 'token|scope' # only the ADRs whose metadata matches
~/.claude/scripts/wm-constraints.py <notes-dir>/adr                # the rules alone, no ADR opened
```

Run the index with `-m` over the terms of the task, open the ADRs whose titles bear on it, then follow their links. Add `--archived` only to audit history.

## Readiness gate

A spec is ready when `QUESTIONS.md` has no section and every live ADR is `approved` (§ Status). `~/.claude/scripts/wm-open-questions.sh <notes-dir>` exits 1 when it has one; `--slugs` lists them. `guard.sh` runs the same check when an edit sets `spec.md` to `status: impl`, and denies the edit.
