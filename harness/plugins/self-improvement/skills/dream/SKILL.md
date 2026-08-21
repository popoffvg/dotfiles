---
name: dream
description: >
  Consolidate the accumulated skill corpus — global (~/.claude/skills) and
  project (.claude/skills). Run periodically to prune dead rules, unite
  overlapping ones, and generalize the over-specific. The complement to
  capture-lesson: that skill captures, this one consolidates.
disable-model-invocation: true
---

Consolidate the skill corpus that capture-lesson accumulates. That skill writes each new lesson *down* into one skill as a fine-grained piece. `dream` walks the corpus *up*: the inverse pass. Run on demand (`/dream`), not automatically.

Before consolidating, `dream` also harvests the sessions the background scan scored high but never turned into lessons — see Step 0 below. Three consolidation operations, all suggested for review before any write:

- **prune** — drop a rule whose anchor is dead (file/flag/workflow gone) or that never fires. Applies to a whole skill or a single rule inside a body.
- **unite** — merge rules that share a trigger into the sharper one — whole skills, or bullets within one body.
- **generalize** — lift an over-specific rule (or a cluster of near-duplicates) into one broader rule that subsumes them.
- **move** — relocate a rule from a skill whose trigger no longer fits it to one that does (a rule bundled in the wrong skill).

# Step 0 — Harvest interesting transcripts

The background scan ([[capture-lesson]] `references/score.md`, driven by the SessionStart hook) only scores a session — 0–10, plus a scope and one line of reason — and writes that to `~/.claude/self-improvement/sessions/<session-id>.json`. A session that scored at or above the keep threshold also gets its transcript copied to `~/.claude/self-improvement/lessons/<scope>/<date>-<topic-slug>-<session-id>.jsonl`. A second pass then writes `suggestions/<session-id>.md` — where that lesson would land in the harness as it stood that day. No recurrence judgment happens in either pass: the score is a cheap haiku guess and the suggestion is one reader's draft, and nobody has yet judged whether the lesson is real or recurs. `dream` closes that loop, in batch, before consolidating:

1. **List unharvested archives, highest score first.** `${CLAUDE_PLUGIN_ROOT}/scripts/records-list.sh` prints one row per scored session with its score and scope; the archived transcripts sit in `~/.claude/self-improvement/lessons/<scope>/`. Harvested transcripts live in `~/.claude/self-improvement/lessons/harvested/` and are done. Work down from the top score — that ordering is the whole point of scoring, and a run that stops early has still taken the most promising sessions. Take the score and the subdir as the scan's guess and re-judge both yourself in step 5: a `global/` transcript can still turn out to be project-scoped, and a 9 can still turn out to be a one-off.
2. **Read the session's suggestion next, if it has one.** `~/.claude/self-improvement/suggestions/<session-id>.md`, pointed at by the record's `suggestion` field. Written by the scan's second pass, it already names a verdict (`covered`, `extend`, `doc`, `new-skill`), a target path, the user's own words as evidence, and the runner-up it rejected — all judged against the harness as it stood that day. Treat it as a first draft by a reader who had the inventory in front of them and the transcript's surrounding context not at all: adopt the target when the evidence holds, and overrule it freely. In particular a `covered` verdict is worth checking hardest, because it is the one that ends the work — open the skill it names and confirm the body really says the rule. A stale suggestion (the target skill has since changed) is normal; the record's `suggested_at` says how old it is.
3. **Read the transcript's `.env.md` sidecar.** Every archived transcript has one beside it, written by the scan: the session topic and one row per git repo that was in context, with branch and origin remote. Read it before the transcript — it is a few lines, and it is where the scope decision's evidence lives. The archive outlives the working directories, so the sidecar is often the only surviving record of which repo a correction was about; never re-derive that from the cwd you are in now.
4. **Per transcript, find and judge corrections.** Extract human prompts (`${CLAUDE_PLUGIN_ROOT}/scripts/human-turns.sh <transcript>`), mark the ones that correct behavior, read the surrounding context (`Read` with `offset`/`limit`) to see what the assistant did. Judge recurrence exactly as [[capture-lesson]] Step 1 does: would you teach this to a colleague, or is it a one-off tied to that session's specific content? A transcript with no recurring correction is harvested with nothing to show for it — delete its `.jsonl` **and its `.env.md`**, move to the next transcript.
5. **Run capture-lesson on what survives.** For each correction that recurs, run [[capture-lesson]] Steps 1–5 (scope, form, find-or-write skill, `CASE.md`, report) as if the scan had run it live, taking the suggestion from step 2 as the starting proposal rather than beginning from nothing. Feed the sidecar's repo rows into Step 1's scope choice and into the `CASE.md` `Repo:` field. Then move the `.jsonl` and its `.env.md` into `~/.claude/self-improvement/lessons/harvested/` and record that final path in the `CASE.md` `Transcript:` field, so the evidence stays reachable and the transcript is never harvested twice.
6. **Report the harvest** before moving on to consolidation below — how many transcripts were unharvested, how many produced a kept lesson vs. were dropped as non-recurring, and which repos they came from (from the sidecars).

Then continue to the consolidation flow, which now also sees whatever skills this step just wrote or extended.

# Flow

1. **Gather.** Collect every rule across scopes, at two granularities:
   - **whole skills** — `~/.claude/skills/*/SKILL.md`, `<repo-root>/.claude/skills/*/SKILL.md`. Read frontmatter `name` + `description` first; that is the trigger and where cross-skill overlap shows.
   - **rules inside a skill body** — a SKILL.md usually bundles several rules (bullet list, numbered steps, sub-sections). Each is a unit dream can prune/unite/generalize on its own, or **move** to a skill whose trigger fits it better. Read bodies for any skill that enters a candidate cluster.
   - **aux files** — a skill may carry `references/*.md`, `GLOSSARY.md`, or helper scripts beside SKILL.md. These hold rules too; include them in a deep read (step 4).
   - **`CASE.md`** — the cases the skill was abstracted from ([[capture-lesson]] Step 4): repo, what went wrong, the correction verbatim, whether the case was ambiguous. This is the evidence layer; the SKILL.md body is only the conclusion drawn from it.

Read in escalating depth — cheap first, deep only where it pays: **descriptions** (all skills) → **bodies** (cluster members) → **aux files + linked docs** (unite/move candidates).

2. **Frame targets by origin.** Autocreated skills carry `metadata.origin: self-improvement` (stamped by [[capture-lesson]]). Those are the prime targets — fine-grained, single-lesson, prone to overlap. Leave hand-authored skills (no marker) alone unless the user says otherwise. Note in each suggestion whether the target is autocreated.

3. **Cluster.** Group rules whose triggers overlap or share a theme. Overlap is invisible in a flat list of 80+ skills — clustering is the load-bearing step. A cluster of one is fine (a lone prune candidate). Clustering off descriptions is a *hypothesis* — a shared trigger is not yet a confirmed overlap.

4. **Deep read (confirm before suggesting a merge).** For every unite/move candidate cluster, read the **full body of each member plus its aux files** before proposing the operation. A trigger match can hide two genuinely different jobs (`go-debug` = interactive Delve vs `go-test-debug` = test-failure workflow), and a body carries unique content a merge must not drop (e.g. `gh-test`'s programmatic JS API absent from `act`). From the deep read, decide: (a) is the overlap real, or do the skills split on backend/purpose? (b) which member is the sharper **survivor**? (c) what unique content from the losers must survive the merge? Record these in the suggestion. Skip deep read only for pure prunes (dead-anchor) — everything that merges or moves rules requires it.

5. **Per cluster, emit suggestions.** For each cluster produce prune / unite / generalize / move suggestions, each with: the target rules (paths), the operation, a one-line reason, and — for unite/move — the survivor and the unique content to preserve (from step 4). Concrete — name the files, quote the overlapping triggers.

6. **Review gate.** Present the full suggestion set grouped by operation. One exchange. The user approves, rejects, or edits per suggestion. Do not write before approval — merging deletes captured lessons and is hard to reverse.

7. **Apply approved.** For each approved suggestion:
   - **prune** → delete the skill dir, or remove the single rule from the body.
   - **unite** → merge bodies into the surviving skill (widen its `description` to cover both triggers), delete the losers.
   - **generalize** → write the broader rule, delete the specifics it subsumes.
   - **move** → cut the rule from the source body, paste into the target skill; widen the target's `description` if the moved rule adds a trigger. If the source body empties, prune the source skill.
   Preserve the origin marker on survivors. After touching `~/.claude/skills`, no stow step is needed (skills are edited in place there); if editing dotfiles sources, run `mise run stow`.

# Detection heuristics

- **prune** — `description`/body names a file, flag, path, or workflow; verify it still exists (`mcp__fff__find_files` / `grep`). Gone → prune. Also prune a rule fully subsumed by a broader sibling.
- **unite** — two+ rules whose `description` triggers match the same task shape. Keep the sharper wording; fold the rest in.
- **generalize** — a cluster of rules that are the same principle at different anchors (e.g. several "verify X before Y" variants). Lift to one rule stated at the shared altitude; the specifics become examples, not separate skills.
- **move** — a bullet inside skill A whose subject matches skill B's `description` better than A's. Relocate it so each rule sits under the trigger that actually fires it.

## From `CASE.md`

The cases decide what the descriptions only hint at:

- **Same incident, two skills** → unite. Two `CASE.md` entries naming the same repo, task, and correction are one lesson captured twice.
- **One case, one repo, global scope** → the scope is unearned. Move the skill to that repo, or keep it global only if a later case names a different repo.
- **Cases from ≥2 repos** → generalization is earned. Lift the rule and let the cases stay as examples.
- **`Ambiguous? yes` but the body reads as a verdict** → rewrite as a check (the question + both branches), or scope it to the repo where the trade-off resolves. See [[capture-lesson]] Step 1b.
- **Dead repo, dead anchor in every case** → prune.
- **No `CASE.md` at all** → the evidence was never recorded; judge on the body alone and say so in the suggestion.

A merge must carry the losers' `CASE.md` entries into the survivor's — the rule survives, so its evidence must too.

# Rules

1. **Suggest before write.** Never prune/unite/generalize without the review gate. This is editorial and irreversible.
2. **Autocreated first.** Target `metadata.origin: self-improvement` skills; touch hand-authored ones only on explicit request.
3. **Cluster before judging.** No suggestions from a flat list — group by trigger first.
4. **Deep read before merging.** Never suggest a unite/move on descriptions alone — read the full bodies + aux files first. A shared trigger is a hypothesis; the body confirms or kills it, and names the content the merge must preserve.
5. **No silent loss.** Every prune/unite states which rules disappear and why. A merged skill's content survives in the survivor.
6. **Widen the survivor's trigger.** When uniting, the surviving `description` must cover every folded-in trigger, or the merge silently disables a path.
7. **Cases follow their rule.** A unite/move carries the source `CASE.md` entries into the target; a prune deletes them with the skill. Never leave a rule whose evidence was dropped.
