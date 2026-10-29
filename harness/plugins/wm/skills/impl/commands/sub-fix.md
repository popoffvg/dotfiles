# code — fix

Fix the **ADR** before the code. Code changed without correcting the ADR drifts back.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`. Commit rules: `sub-commit.md`; the message itself: the `commit-message` skill.

The user points at a gap — a **bug** (behavior wrong), a **missing part** (behavior absent), or an **adjust** (behavior works but should change). The loop: locate the ADR → refine it, supersede it, or record a new one → fix the code.

## Trigger kinds

| Kind | What the user points at | ADR action |
|---|---|---|
| **bug** | broken behavior — output wrong, crash, regression | a Property is **wrong** → refine the ADR, or supersede it when the decision itself reverses |
| **missing** | something never built — a case unhandled, a step skipped | a Property or an ADR is **missing** → add a Property, or record a new ADR |
| **adjust** | working behavior that should differ — new requirement, changed decision | the ADR is **outdated** → refine it, or supersede it when the decision itself reverses |

**The ADR can be correct (code-only drift).** When the gap traces to no ADR change — the ADR is correct and only the code diverged (typo, off-by-one, a branch that breaks the Property it cites) — skip Steps 2–3, go to Step 4. Report: *"no ADR change — code diverged from a correct ADR."*

## Contract

- **Start at the ADR.** Every fix opens with: *"Refine or supersede an existing ADR, record a new one, or is the ADR already correct (code-only drift)?"* Rule the correct-ADR case out before touching code.
- **One ADR per fix.** Multiple affected ADRs → one `/code fix` each, in sequence.
- Correct the ADR (or confirm it's already right) before changing code. A code change over a standing wrong ADR is deferred drift.

## Step 1: Analyze the cause

Before touching code, answer three, one sentence each:

1. **What's the gap?** — observable symptom (bug), absent behavior (missing), or desired change (adjust).
2. **Which ADR is involved?** — the ADR, and the Property `ADR-NNNN/Pn`, that is wrong, outdated, or absent. An `implementation` ADR of the TODO counts.
3. **What should the ADR say instead?** — the corrected Property, or the new decision.

No existing ADR covers the gap (always for **missing**, sometimes **adjust**) → the cause is a missing decision; record a new ADR in Step 3.

### Find the wrong ADR

**Run the `trace` skill** — quote the artifact the gap sits in (a printed constraint, a `## Surface` symbol, an `Autotest` level, an increment) and ask what settled it. It searches `adr/` in a subagent and returns the chain plus a verdict: `live` names the ADR to correct, `superseded` names the drift, `unrecorded` means the choice was made in code and never written down, which is itself the cause.

Search by hand only when the trace comes back `unrecorded` and you want to widen it: `~/.claude/scripts/wm-adr-index.py <notes-dir>/adr -m '<terms of the gap>'` prints one line per matching ADR (`arch:ref-adr-format.md` § Find the ADRs for a task). Open those, not the rest. A wrong fact sits in the research artifact the ADR cites; correct it there too.

- Which fact was wrong? (e.g. "Token TTL is 15 min" but the code uses 5 min)
- Which decision was wrong? (e.g. "Reject concurrent refreshes" but they should be queued)
- Which implementation choice was wrong? (e.g. "Use sync.Mutex" but the code spans goroutines)

Show the user: *"Found it: `ADR-0003/P2` is wrong because X. The correction is Y."* Wait for confirmation.

## Step 2: Correct the ADR

On confirmation, refine or supersede as `arch:ref-adr-format.md` § Refine in place, reverse by supersede says:

- **Refine** — edit the Property in place, with the reason in the changelog line. Commit in `<notes-dir>`: `fix: refine ADR-NNNN/Pn`.
- **Supersede** — the decision itself reverses: the option it chose loses to one it rejected. A changed value or error code under the same option is a refine. Write the replacement in Step 3 first, then append the changelog line `Superseded by [ADR-MMMM](../MMMM-slug.md)` to the old ADR. Leave the file where it is; the `adr-archive.sh` hook moves it and prints the live ADRs whose links you repoint. Commit in `<notes-dir>`: `fix: supersede ADR-NNNN by ADR-MMMM`.

## Step 3: Record the new ADR

Only for a supersede, or a gap no ADR covers. Record it as an ADR with the `adr` skill, at the next number in `adr/` and `adr/archived/`, same `kind` as the original (`architecture`, `feature`, or `implementation` with `todo: TODO-N`). A supersede names the old ADR in its opening paragraph as `[ADR-NNNN](NNNN-slug.md)`.

**The rule set follows on its own.** The generator reads the Properties of the live ADRs: a refined Property is the new rule text, and a superseded ADR leaves the rule set when the hook archives it. There is nothing to repoint in a TODO. A new ADR binds once it is in `adr/`, and it is written there only after the user approves it. Show the draft and wait for that approval before Step 4.

Commit in `<notes-dir>`: `fix: add ADR-MMMM`.

## Step 4: Fix the code

With the ADR corrected:

1. Read the corrected ADR, and the superseded one when there is one — understand what changed.
2. Find the files from `todos/TODO-N.agent.md` **Files**.
3. On a **bug**, follow the `red-green-refactor` skill: write the failing test that reproduces the gap before any production edit.
4. Make the minimal change aligning code with the corrected ADR.
5. If the fix renames or introduces a domain term, get the user's approval and write the row into `<notes-dir>/GLOSSARY.md` in the same commit, and rename every use in the notes and the code (`code:ref-subcommand-rules.md` § Glossary).
6. Run the TODO's Autotest.
7. Commit per the `commit-message` skill, `fix:` prefix. The ADR numbers stay in the notes-dir commit (Step 5) and never enter the code-repo message.

## Step 5: Report

In `<notes-dir>`:

```
jj commit -m "[FIX:<kind>] <one-line gap>
  - adr: ADR-NNNN refined (Pn) | ADR-NNNN superseded (reason: <reason>) | none (missing) | none (code-only drift)
  - new adr: ADR-MMMM | none
  - commit: <sha>
  - autotest: pass | fail (details)"
```

`<kind>` is `bug`, `missing`, or `adjust`. Send the user:

1. **Gap**: one-line symptom / absent behavior / desired change (with kind)
2. **Old ADR**: ADR-NNNN — refined or superseded (reason), or *none* (missing / code-only drift)
3. **New ADR**: ADR-MMMM — what it decides, or *none*
4. **Commit**: sha + subject
5. **Autotest**: command + outcome
