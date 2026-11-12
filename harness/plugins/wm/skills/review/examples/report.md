# review — the report file

> A filled `<notes-dir>/review/TODO-3/report.md`. reviewrules writes it; the caller never edits
> it. The run behind it is `ref-reviewrules.md`.

```
PASS   medium  wm/reuse-existing-job
FAIL   medium  wm/lying-name
       writer/column.py:34 — `rid` reads as a row id in a writer that also writes rows; rename it to `run_id`
FAIL   low     wm/abbreviation
       writer/column.py:12 — `cfg` is an abbreviation; write `config`
PASS   medium  notes/ADR-0003/P2
WARN   high    wm/unmigrated-caller rule fork returned no requirement checks
CONFIRMED H2 writer/column.py:51 — does an empty batch write a header with no rows?
          input that breaks it: write([])
          evidence: writer/column.py:51 writes the header before the length check
          fix: return before the header when the batch is empty
usage: total in=412k cached=380k out=9k
usage: rules       haiku in=120k cached=110k out=2k cost=$0.0130
cost estimate: total $0.4210
```

> **Each rule line is `<verdict> <severity> <rule id>`.** The findings of a FAIL sit under it, one
> `file:line — message` each, and the message ends in the edit that closes it.
>
> `WARN` is a fork that gave no verdict. It does not fail the run unless the repo settings set
> `fail_on_unanswered`. Name it in the reply, because a rule with no verdict checked nothing.
>
> A `low` FAIL is a nit: the run stays green, and a fixup brief marks it optional.
>
> `CONFIRMED` is a correctness hypothesis that the checker fork proved, with the input that breaks
> the code. It fails the run like a FAIL.
