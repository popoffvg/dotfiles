# spec — revise

## Purpose

After a TODO has been implemented, the actual code often diverges from the
TODO body (different files touched, extra refactor, missing step, renamed
symbols). This skill **rewrites the spec/TODO to match the implementation**,
not the other way around. Use it before iterating on the next TODO so the
spec stays a faithful target picture.

## Invocation

```
/work:spec-revise <TODO-N>
```

- `<TODO-N>` is the TODO id, e.g. `TODO-3`. Required.
- Optional second arg: a git revision (`<sha>`, `<sha>..HEAD`, or branch) to
  pin the commit. If omitted, discovery runs in the order below.

## CRITICAL RULES

- **Read-only on source code.** No edits outside `<notes-dir>/`.
- Edits are limited to: `<notes-dir>/spec.md`, `<notes-dir>/todos/TODO-N.md`,
  `<notes-dir>/worklog.md`.
- Never reorder or renumber other TODOs.
- Never delete a TODO outcome — if the implementation diverged, **rewrite**
  the outcome to describe what was actually delivered.

## Step 1 — Locate the commit(s) for TODO-N

Try in order, stop at the first hit:

1. **User-supplied SHA / range** from the second arg.
2. **Worklog.** Grep `<notes-dir>/worklog.md` for `TODO-N` lines that mention
   a SHA or commit subject.
3. **Commit message search.**
   ```bash
   git log --all --oneline --grep="TODO-N\b"
   ```
4. **`impl-learnings.md`.** Check `<notes-dir>/impl-learnings.md` for a
   `TODO-N` entry that pins a SHA.
5. **Heuristic.** If exactly one commit exists between the previous TODO's
   commit and `HEAD`, assume it. Otherwise **stop and ask the user** for the
   SHA — do not guess.

Record the chosen SHA(s) and one-line subject so the user can verify.

## Step 2 — Inspect the implementation

For each commit:

```bash
git show --stat <sha>
git show <sha>
```

Extract:

- Files touched (added/modified/deleted)
- Public symbols added or renamed
- Behavior introduced or removed
- Tests added
- Anything that **was not** in the original TODO body but landed anyway
- Anything that **was** in the TODO body but did **not** land

## Step 3 — Diff spec vs reality

Compare the commit findings against:

- The TODO outcome row in `<notes-dir>/spec.md` (TODO List).
- The body of `<notes-dir>/todos/TODO-N.md` — especially the `## Changes`
  section (TS pseudocode) and any acceptance criteria.

Categorize each delta as one of:

| Category | Meaning | Action |
|----------|---------|--------|
| **Drift** | Implementation differs from spec but outcome is still met | Update TODO body to match reality |
| **Outcome shift** | The observable result changed | Rewrite the outcome row in spec.md AND the outcome line in TODO-N.md (verbatim match) |
| **Scope creep** | Extra work landed that belongs in another TODO | Move the description into that other TODO (or add a new TODO row in spec.md TODO List) |
| **Missed step** | Planned work did not land | Either (a) carry it forward as a new TODO row, or (b) drop it from the spec with a Design Decision note explaining why |
| **Discovery** | New constraint/decision surfaced | Add to spec.md **Design Decisions** |

If the user has not weighed in on an Outcome shift or Missed-step drop, **ask
before rewriting** — these change the contract of the spec.

## Step 4 — Apply edits

In `<notes-dir>/spec.md`:

- Update the TODO List row for `TODO-N` if the outcome shifted.
- Append Design Decisions for any discovery worth recording.
- Add new TODO rows for scope-creep splits or missed-step carry-forwards.

In `<notes-dir>/todos/TODO-N.md`:

- Restate the (possibly new) outcome verbatim at the top.
- Rewrite `## Changes` to describe what actually shipped — same TS pseudocode
  style required by `flow`.
- Update file paths, function names, and acceptance criteria so a reader can
  audit the commit against the TODO without surprises.
- Mark the TODO as completed per the plugin's convention (checkbox / status
  line) if not already.

In `<notes-dir>/worklog.md`:

- Append one entry: `YYYY-MM-DD HH:MM  revise TODO-N from <sha>` plus a
  one-line summary of the deltas applied.

## Step 5 — Report

Print a short summary to the user:

```
Revised TODO-N from <sha> "<subject>"
  outcome: <unchanged | rewritten>
  body:    <files / sections updated>
  spinoffs: <new TODO rows, if any>
  decisions: <added to spec.md, if any>
```

Then stop. The user owns the next action (continue implement, re-verify, etc).

## Checklist

- [ ] Commit(s) for TODO-N located and SHA(s) recorded
- [ ] Spec-vs-reality deltas categorized (drift / outcome shift / scope creep / missed step / discovery)
- [ ] Outcome-shifting or step-dropping edits confirmed with the user
- [ ] `spec.md` TODO List row, Design Decisions, and any new rows updated
- [ ] `todos/TODO-N.md` outcome restated; `## Changes` matches the commit
- [ ] `worklog.md` appended
- [ ] No edits outside `<notes-dir>/`
