# Rules — what to discuss directly

Template for `<notes-dir>/RULES.md`: the interaction contract. It says, per pipeline step, what
goes to the human **directly** and what the agent decides alone. Written by `/code new` Step 0.6
from the answered init questions; the defaults below apply to anything the user did not answer.

Every subcommand reads `<notes-dir>/RULES.md` before it starts, and obeys it over its own
defaults. A rule here never lowers a hard gate: the gate at `review→impl` stays a human read, and
an outcome-shifting or destructive edit is always confirmed.

## Init questions — ask these, do not assume

Ask all four in one `AskUserQuestion` batch at Step 0.6, before the grill. The first option of
each is the default; a skipped question takes it.

| # | Question | Options (default first) | Writes to |
|---|----------|-------------------------|-----------|
| 1 | During `impl`, how much do you approve? | each increment · once per TODO · autonomous until the TODO is done | `impl` row |
| 2 | During the grill, which questions reach you? | every open question · only blockers (the agent reads the codebase for the rest) · batch them at the end | `new` row |
| 3 | When are tests written? | before the code (red-green-refactor) · in the same increment as the code · after the code lands | `impl` row |
| 4 | Who commits? | agent commits each green TODO · ask before every commit · agent commits notes only, human commits code | `commit` row |

## Rules table

Fill the **Direct** column from the answers; keep the **Alone** column unless the user changes it.

| Step | Direct — ask the human | Alone — decide and log |
|------|------------------------|------------------------|
| `new` | Scope, the Goal, anything in What we're NOT doing, every open question per answer 2, any decision that changes the target picture | Facts the codebase answers, wording, note numbering, glossary terms |
| `todo` | A ledger row that must split or merge, an outcome the body cannot deliver | Body wording, file lists, test names, wave grouping that follows the real edges |
| `verify` | Nothing — report the verdict | The whole audit |
| `impl` | Per answer 1; plus any file outside the TODO's **Files**, and any new dependency | Code shape inside the TODO's Files, refactors the outcome needs |
| `revise` | Outcome shifts, dropped steps, superseding a decision the human made | Drift edits where the outcome still holds, back-links, archive moves |
| `fix` | The root cause, when two fixes are both defensible | The fix once the root cause is agreed |
| `commit` | Per answer 4; always for history-rewriting or tree-removing git actions | Commit message wording |

## Copy block

Everything below the line is the file to write. Replace each `<…>` with the answer.

---

```markdown
# Rules

The interaction contract for this corpus. Every `/code` subcommand reads this file first and
obeys it over its own defaults. Hard gates stand regardless: the human reads the spec at the
`review→impl` gate, and destructive git actions are always confirmed.

## Answers

| Knob | Setting |
|------|---------|
| Approval during `impl` | <each increment \| once per TODO \| autonomous> |
| Questions during the grill | <every open question \| blockers only \| batched at the end> |
| Test timing | <before the code \| same increment \| after the code> |
| Commits | <agent commits each green TODO \| ask every commit \| notes only> |

## Per step

| Step | Direct — ask me | Alone — decide and log |
|------|-----------------|------------------------|
| `new` | <…> | <…> |
| `todo` | <…> | <…> |
| `verify` | Nothing — report the verdict | The whole audit |
| `impl` | <…> | <…> |
| `revise` | Outcome shifts, dropped steps, superseding a decision I made | Drift edits where the outcome holds, back-links, archive moves |
| `fix` | The root cause, when two fixes are both defensible | The fix once the root cause is agreed |
| `commit` | <…> | Commit message wording |

Change a rule by editing this file — no subcommand rewrites it after Step 0.6.
```
