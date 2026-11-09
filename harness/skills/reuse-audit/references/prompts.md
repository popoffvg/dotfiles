# reuse-audit prompts

Fill `<...>`. Every prompt names absolute paths and a report file in the scratchpad.

## Area auditor (sonnet, read-only)

```
Deliverable: a report at <scratchpad>/audit-<X>.md. Return only its path and a one-line verdict.

Task: audit Go code for REINVENTED patterns: code that hand-writes what a package of this module, a direct go.mod dep, or the stdlib already gives. READ-ONLY: edit no source file.

Repo root: <root> (module <module>, go <version>). Scope (non-test .go files, ~<N> lines): <dirs>.
Package map, read it first: <scratchpad>/package-map.md. Open the source of a package before you claim it fits.
Look at these first for this area: <the helper packages and deps that match the area's work>.

Look for: retry/backoff/poll loops; cancelable sleeps; exec wrappers; error matching by text where a sentinel exists; slice/map/string helpers the stdlib has; hand-rolled protocol or client code beside a dep in go.mod; the same helper twice inside the target.

Report, one entry per finding, ranked by lines removed × risk reduced, max 25:
- `file:line`: what is hand-written (quote ≤5 lines)
- Existing replacement: package + symbol, with the `file:line` you opened
- Fit: exact | partial (what differs)
- Effort: S/M/L
Then "Checked, not reinvented": the patterns you checked and found fine.
```

## Mechanical scan (sonnet, read-only; may write scripts in the scratchpad)

```
Deliverable: a report at <scratchpad>/audit-scan.md. Return the path and a one-line verdict.

Find reinvented code in <target> with a bottom-up method, not file by file. Other agents read it area by area; you give the cross-cutting view.
1. Name collisions: func/type names declared 2+ times in the target, and names that also exist in <helper-dirs>. Open both sides: same behavior, or only the same name.
2. Body-shape clones: hash normalized function bodies with a small go/ast program (or `dupl -t 50` if installed). Report clusters of 2+ with ≥6 lines.
3. Stdlib idioms: hand loops that slices/maps/strings/cmp/min/max cover. Top 15 by file:line.
4. One capability done two ways: two YAML libs, two error packages, retry lib beside time.Sleep/time.After loops. Classify every time.Sleep/time.After/NewTimer in non-test code.
Before you report "none found" for a method, run the same query where a hit surely exists, and say so.
End with "Top 10 to fix" ranked by lines removed.
```

## Writer (sonnet, edits files, never runs git)

```
Deliverable: <the fix>, tests green, report at <scratchpad>/fix-<U>.md (changed files, behavior changes, test results). Return the path and a one-line verdict.

Checkout: <worktree>. Write scope: <exact files>; a caller you must change is in scope only if you list it. Other agents edit other files at the same time: touch nothing else, run no git command, do not commit.

Items (verified): <file:line → replacement at file:line, per item>.
Keep public names, signatures and error messages unless an item says otherwise. If the replacement changes tested behavior, keep the old code for that item and say why.
Code rules: <house error package>; comments only where the code needs them; <forbidden words> MUST NOT appear in anything you write.
Verify: build the target, vet and test your packages. Report exact results.
```
