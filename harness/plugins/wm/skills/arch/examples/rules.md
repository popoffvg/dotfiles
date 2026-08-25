# Rules

> Copy to `<notes-dir>/RULES.md`, replacing any answer the user changed — the answers below are the
> **defaults**. Written once by `/code new` Step 0.6; no later subcommand rewrites it.
>
> Ask the three knobs in one `AskUserQuestion` batch before the grill. The setting shown below is the
> first option of each, which a skipped question takes:
>
> 1. During the grill, which questions reach you? — **every open question** · only blockers (the agent reads the codebase for the rest) · batch them at the end
> 2. When are tests written? — **before the code (red-green-refactor)** · in the same increment as the code · after the code lands
> 3. Who commits? — **agent commits each green TODO** · ask before every commit · agent commits notes only, human commits code
>
> How much of `impl` the human approves is **not** a knob here — it is the `spec.md` frontmatter
> `approve` key (`arch:ref-write.md` § Approval), asked in the same batch and written there.

The interaction contract for this corpus. Every `/code` subcommand reads this file first and obeys
it over its own defaults. Hard gates stand regardless: the human reads the spec at the
`review→impl` gate, and destructive git actions are always confirmed.

## Answers

| Knob | Setting |
|------|---------|
| Questions during the grill | every open question |
| Test timing | before the code |
| Commits | agent commits each green TODO |

## Per step

| Step | Direct — ask me | Alone — decide and log |
|------|-----------------|------------------------|
| `new` | Scope, the Goal, anything in What we're NOT doing, every open question, any decision that changes the target picture | Facts the codebase answers, wording, note numbering, glossary terms |
| `todo` | A ledger row that must split or merge, an outcome the body cannot deliver | Body wording, file lists, test names, wave grouping that follows the real edges |
| `verify` | Nothing — report the verdict | The whole audit |
| `impl` | Any file outside the TODO's **Files**, and any new dependency. What else it shows is the spec's `approve` key, not a row here | Code shape inside the TODO's Files, refactors the outcome needs |
| `revise` | Outcome shifts, dropped steps, superseding a decision I made | Drift edits where the outcome holds, back-links, archive moves |
| `fix` | The root cause, when two fixes are both defensible | The fix once the root cause is agreed |
| `commit` | History-rewriting or tree-removing git actions | Commit message wording |

> The **Direct** column is written from the three answers; the **Alone** column stands as shown
> unless the user changes it. A rule here never lowers a hard gate.

Change a rule by editing this file — no subcommand rewrites it after Step 0.6.
