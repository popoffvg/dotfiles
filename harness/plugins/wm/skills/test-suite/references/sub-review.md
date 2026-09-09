# Sign-off — the human accepts or rejects what shipped

The implementation is in the working tree and the gates have run. This step puts the result in front
of the human, in the form they can decide on, and then routes the decision they make. It writes no
source and runs no test — the numbers it reports come from runs that already happened.

Naming: this step is the **human's** accept-or-reject. Auditing a test set for missed cases is
[`sub-verify.md`](sub-verify.md), and judging whether the code is built right is the `review` skill's
gate chain (`review:SKILL.md`). Neither of those asks the human anything.

## Step 1 — collect the criteria the human agreed to

Read them from the artifacts that hold them, in this order:

| Source | What it gives |
|---|---|
| `<notes-dir>/spec.md` | The ledger row for this TODO — its `Outcome` and `Concretely` lines, which are what the human aligned on before any body existed. |
| `<notes-dir>/todos/TODO-N.md` | `Outcome`, `Surface`, and `Autotest` — the human half of the pair, restating the ledger outcome verbatim at the top. |
| `<notes-dir>/review/TODO-N/report.md` | The merged gate verdict, if the gate chain ran. |

The artifact set is `arch:ref-write.md` § Artifacts. Done when every criterion you will report traces
to a line in one of those files — a criterion you invented is a criterion the human never agreed to.

## Step 2 — write the summary

Four sections, in this order:

1. **What shipped** — the files changed and the tests added or changed.
2. **Criterion by criterion** — each criterion from Step 1 with `met` or `not met`, and one sentence
   of evidence for each: the assertion that covers it, or the behaviour you exercised by hand.
3. **Test results** — the pass and fail counts from the last real run, and the failing case names.
4. **Open** — anything incomplete, anything you are unsure of, anything you decided along the way
   that the human has not seen.

Name every case by the string the test set and the test function share — `expired-token-is-rejected`.
The human is deciding, so a line they have to look up is a line they skip. Group failures under the
behaviour they break, not under the file they live in. The full output contract is
[`ref-readable-output.md`](ref-readable-output.md).

Done when each of the four sections carries content or the words "none", and every criterion from
Step 1 appears exactly once.

## Step 3 — stop and let the human answer

End your turn on the summary. The human's answer decides where the work goes, and no route runs
before they give one. Done when you have made no further tool call.

## Step 4 — route the answer

| The human says | Run |
|---|---|
| Accepted | `/wm:work:finish` — closes the wm flow for this workspace. |
| These specific things need changing | The `code` skill's `fix` subcommand (`impl:sub-fix.md`) — one gap at a time, thought first, then code. |
| The spec was wrong, not the code | `/wm:work:code-revise <TODO-N>` — rewrites `spec.md` and the TODO pair to match what shipped. Notes only. |
| Start this TODO over | The `code` skill's `revise` subcommand, then `impl` again. |
| Where does this stand | `/wm:work:status`. |

Every route above goes back through the spec or the thought before it touches source. That is the
one hard rule of this step: a change the human asks for lands as a `fix` or a `revise`, never as an
edit made straight from a chat line.

Done when you have named exactly one route and started it, or the human has stopped the session.

## Step 5 — record it

Append one line to `<notes-dir>/worklog.md`:

```
- YYYY-MM-DD HH:MM: sign-off TODO-N — <accepted | changes requested | spec revised>
```

Done when the line is in the file and the notes' jj repo has it (`code:ref-jj-notes.md`).
