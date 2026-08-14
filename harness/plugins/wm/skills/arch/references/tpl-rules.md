# Rules

> This file is the finished `<notes-dir>/RULES.md`, filled with the **default** answer to each of
> the four knobs. Copy it there, replace any answer the user changed, and delete every `>` line.
> Written once by `/code new` Step 0.6; no later subcommand rewrites it.
>
> Ask the four knobs in one `AskUserQuestion` batch before the grill. The setting shown below is the
> first option of each, which a skipped question takes:
>
> 1. During `impl`, how much do you approve? — **each increment** · once per TODO · autonomous until the TODO is done
> 2. During the grill, which questions reach you? — **every open question** · only blockers (the agent reads the codebase for the rest) · batch them at the end
> 3. When are tests written? — **before the code (red-green-refactor)** · in the same increment as the code · after the code lands
> 4. Who commits? — **agent commits each green TODO** · ask before every commit · agent commits notes only, human commits code

The interaction contract for this corpus. Every `/code` subcommand reads this file first and obeys
it over its own defaults. Hard gates stand regardless: the human reads the spec at the
`review→impl` gate, and destructive git actions are always confirmed.

## Answers

| Knob | Setting |
|------|---------|
| Approval during `impl` | each increment |
| Questions during the grill | every open question |
| Test timing | before the code |
| Commits | agent commits each green TODO |

## Per step

| Step | Direct — ask me | Alone — decide and log |
|------|-----------------|------------------------|
| `new` | Scope, the Goal, anything in What we're NOT doing, every open question, any decision that changes the target picture | Facts the codebase answers, wording, note numbering, glossary terms |
| `todo` | A ledger row that must split or merge, an outcome the body cannot deliver | Body wording, file lists, test names, wave grouping that follows the real edges |
| `verify` | Nothing — report the verdict | The whole audit |
| `impl` | Every increment; plus any file outside the TODO's **Files**, and any new dependency | Code shape inside the TODO's Files, refactors the outcome needs |
| `revise` | Outcome shifts, dropped steps, superseding a decision I made | Drift edits where the outcome holds, back-links, archive moves |
| `fix` | The root cause, when two fixes are both defensible | The fix once the root cause is agreed |
| `commit` | History-rewriting or tree-removing git actions | Commit message wording |

> The **Direct** column is written from the four answers; the **Alone** column stands as shown
> unless the user changes it. A rule here never lowers a hard gate.

Change a rule by editing this file — no subcommand rewrites it after Step 0.6.
