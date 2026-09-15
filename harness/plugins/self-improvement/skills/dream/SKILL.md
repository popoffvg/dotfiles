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

Before consolidating, `dream` also harvests the sessions the background scan scored high but never turned into lessons — see Step 0 below. Every candidate from both halves — harvest and consolidation — carries a **fast-win score** (below) and reaches the operator as one editable review file written through the [[to-user]] skill. Three consolidation operations, all suggested for review before any write:

- **prune** — drop a rule whose anchor is dead (file/flag/workflow gone) or that never fires. Applies to a whole skill or a single rule inside a body.
- **unite** — merge rules that share a trigger into the sharper one — whole skills, or bullets within one body.
- **generalize** — lift an over-specific rule (or a cluster of near-duplicates) into one broader rule that subsumes them.
- **move** — relocate a rule from a skill whose trigger no longer fits it to one that does (a rule bundled in the wrong skill).

# Fast-win score

Every candidate carries two integers, 1–5, and their difference:

- **impact** — how much the harness improves if this lands. 5 = a rule that fires in most sessions, or a prune that removes a skill from every context window. 1 = one rule in one repo the operator rarely enters.
- **effort** — what it costs to land. 1 = delete a dir, move one bullet, write one short skill from a suggestion that already holds. 5 = a deep read across several bodies, a merge that must preserve unique content, or a rewrite the operator has to judge line by line.
- **fast-win = impact − effort.**

Write the pair in every block as `**Fast-win:** +3 (impact 4 / effort 1)`. **Order the whole review file by fast-win, highest first**, across both halves — a harvest lesson and a prune suggestion compete on the same scale. Ties break on impact.

The scan's own 0–10 session score is not impact. It says "this transcript looks interesting", nothing about what the lesson is worth once read. Read the transcript first, then score.

A negative fast-win is kept, not dropped — it goes at the bottom, and its block says in one clause why it still earns a place in the file.

# Step 0 — Harvest interesting transcripts

The background scan (`capture-lesson:references/score.md`, driven by the SessionStart hook) only scores a session — 0–10, plus a scope and one line of reason — and writes that to `~/.claude/self-improvement/sessions/<session-id>.json`. A session that scored at or above the keep threshold also gets its transcript copied to `~/.claude/self-improvement/lessons/<scope>/<date>-<topic-slug>-<session-id>.jsonl`. A second pass then writes `suggestions/<session-id>.md` — where that lesson would land in the harness as it stood that day. No recurrence judgment happens in either pass: the score is a cheap haiku guess and the suggestion is one reader's draft, and nobody has yet judged whether the lesson is real or recurs. `dream` closes that loop, in batch, before consolidating:

1. **List unharvested archives, highest score first.** `${CLAUDE_PLUGIN_ROOT}/scripts/records-list.sh` prints one row per scored session, sorted by session id — re-sort it on the score column yourself (`sort -t\x27\t\x27 -k5,5rn`). The archived transcripts sit in `~/.claude/self-improvement/lessons/<scope>/`. Harvested transcripts live in `~/.claude/self-improvement/lessons/harvested/` and are done — decide that by searching that dir for the session id, never by reading the record's `archive` field, which still names the pre-harvest path. A record whose archive file is in neither place is unprocessable: report it in the count and move on. Work down from the top score — that ordering is the whole point of scoring, and a run that stops early has still taken the most promising sessions. Take the score and the subdir as the scan's guess and re-judge both yourself in step 5: a `global/` transcript can still turn out to be project-scoped, and a 9 can still turn out to be a one-off.
2. **Read the session's suggestion next, if it has one.** `~/.claude/self-improvement/suggestions/<session-id>.md`, pointed at by the record's `suggestion` field. Written by the scan's second pass, it already names a verdict (`covered`, `extend`, `doc`, `new-skill`), a target path, the user's own words as evidence, and the runner-up it rejected — all judged against the harness as it stood that day. Treat it as a first draft by a reader who had the inventory in front of them and the transcript's surrounding context not at all: adopt the target when the evidence holds, and overrule it freely. In particular a `covered` verdict is worth checking hardest, because it is the one that ends the work — open the skill it names and confirm the body really says the rule. A stale suggestion (the target skill has since changed) is normal; the record's `suggested_at` says how old it is.
3. **Read the transcript's `.env.md` sidecar.** Every archived transcript has one beside it, written by the scan: the session topic and one row per git repo that was in context, with branch and origin remote. Read it before the transcript — it is a few lines, and it is where the scope decision's evidence lives. The archive outlives the working directories, so the sidecar is often the only surviving record of which repo a correction was about; never re-derive that from the cwd you are in now.
4. **Per transcript, find and judge corrections.** Extract human prompts (`${CLAUDE_PLUGIN_ROOT}/scripts/human-turns.sh <transcript>`), mark the ones that correct behavior, read the surrounding context (`Read` with `offset`/`limit`) to see what the assistant did. Judge each one against `references/judge.md` — the two gates and the harvest scoring anchors. A transcript where nothing passes the gates is harvested with nothing to show for it — delete its `.jsonl` **and its `.env.md`**, move to the next transcript.
5. **Score each surviving correction, and propose it — do not write it yet.** For each correction that recurs, work [[capture-lesson]] Steps 1–3 far enough to name the scope, the form, and the target skill (extend which file, or a new dir at which path), taking the suggestion from step 2 as the starting proposal rather than beginning from nothing. Feed the sidecar's repo rows into the scope choice. Score it, and hold it as a block for the review file — a harvest block is a suggestion like any other, and nothing is written before the gate.
6. **Move the transcript only after its block is approved and applied.** Run the rest of [[capture-lesson]] on the approved block, then move the `.jsonl` and its `.env.md` into `~/.claude/self-improvement/lessons/harvested/`, so a transcript is never harvested twice.
7. **Count the harvest** for the review file header — how many transcripts were unharvested, how many produced a block, how many were dropped at the gates, and which repos they came from (from the sidecars).

Then continue to the consolidation flow. Its suggestions and the harvest blocks go into **one** review file, ordered together by fast-win.

# Step 0.5 — Read the health rollup

Regenerate `~/.claude/self-improvement/health/rollup.json` (`${CLAUDE_PLUGIN_ROOT}/scripts/health-rollup.py --days 90`) — per-skill usage and failure counts extracted from every transcript before Claude Code's 30-day cleanup deletes it. Seed the consolidation with three of its fields:

- **`bucket: DEAD`** — installed and enabled, zero invocations in the window → prune candidates, ranked by `tokens` (always-resident listing cost). Events reach back only to when collection started, so a DEAD verdict younger than the window is weak — say so in the suggestion.
- **`bucket: BROKEN`** and the `ghost_skills` rows marked `BROKEN` — a name that still errors → rename or re-point suggestions: something refers to a skill that moved. Rows marked `PROJECT_SCOPED` are a repo's own skill reached from another repo, and `DISABLED` is `skillOverrides` doing its job; neither is a defect and neither is prunable.
- **`bucket: UNTRIGGERED`** — `by_human` above zero while `by_model` stays zero: the human reaches for the skill by name and the model never picks it up. The rule is wanted, so this is never a prune. It is a `description` that fails to name the situations the skill is for, and the fix is rewriting that trigger against the sessions where the human had to ask. Skills declaring `disable-model-invocation` or `model-invocable: false` are exempt, being human-entry points by design.
- **`interrupt_follow` / `ask_follow`** high relative to `uses` — the skill fires but fights the user. Open the transcript before suggesting anything: a skill whose job *is* interviewing scores here by working, so the count only says which transcript to read.

# Flow

1. **Gather.** Collect every rule across scopes, at two granularities:
   - **whole skills** — `~/.claude/skills/*/SKILL.md`, `<repo-root>/.claude/skills/*/SKILL.md`. Read frontmatter `name` + `description` first; that is the trigger and where cross-skill overlap shows.
   - **rules inside a skill body** — a SKILL.md usually bundles several rules (bullet list, numbered steps, sub-sections). Each is a unit dream can prune/unite/generalize on its own, or **move** to a skill whose trigger fits it better. Read bodies for any skill that enters a candidate cluster.
   - **aux files** — a skill may carry `references/*.md`, `GLOSSARY.md`, or helper scripts beside SKILL.md. These hold rules too; include them in a deep read (step 4).

Read in escalating depth — cheap first, deep only where it pays: **descriptions** (all skills) → **bodies** (cluster members) → **aux files + linked docs** (unite/move candidates).

2. **Frame targets by origin.** Autocreated skills carry `metadata.origin: self-improvement` (stamped by [[capture-lesson]]). Those are the prime targets — fine-grained, single-lesson, prone to overlap. Leave hand-authored skills (no marker) alone unless the user says otherwise. Note in each suggestion whether the target is autocreated.

3. **Cluster.** Group rules whose triggers overlap or share a theme. Overlap is invisible in a flat list of 80+ skills — clustering is the load-bearing step. A cluster of one is fine (a lone prune candidate). Clustering off descriptions is a *hypothesis* — a shared trigger is not yet a confirmed overlap.

4. **Deep read (confirm before suggesting a merge).** For every unite/move candidate cluster, read the **full body of each member plus its aux files** before proposing the operation. A trigger match can hide two genuinely different jobs (`go-debug` = interactive Delve vs `go-test-debug` = test-failure workflow), and a body carries unique content a merge must not drop (e.g. `gh-test`'s programmatic JS API absent from `act`). From the deep read, decide: (a) is the overlap real, or do the skills split on backend/purpose? (b) which member is the sharper **survivor**? (c) what unique content from the losers must survive the merge? Record these in the suggestion. Skip deep read only for pure prunes (dead-anchor) — everything that merges or moves rules requires it.

5. **Per cluster, emit suggestions.** For each cluster produce prune / unite / generalize / move suggestions, each with: the target rules (paths), the operation, a one-line reason, its fast-win score, and — for unite/move — the survivor and the unique content to preserve (from step 4). Concrete — name the files, quote the overlapping triggers.

6. **Review gate — write the file, do not present it in chat.** Run the [[to-user]] skill over the whole set, harvest blocks and consolidation suggestions together, with four `dream` specifics:

   - The file is `dream-decisions.md`, in the notes dir of the repo the session runs in, or the scratchpad when there is none.
   - **One order: fast-win, highest first.** Not grouped by operation — the operator reads down and stops when they run out of attention, and what they read first is what pays most.
   - Every block carries the `**Fast-win:**` line under **Detail**, and **Recommended** is pre-filled into the `**Answer:**` slot. Leaving a block alone accepts it; `no` rejects it.
   - A header line stating that nothing is written until answers come back, and the harvest count from Step 0.7.

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

# Rules

1. **Suggest before write.** Nothing — a harvested lesson included — is written before the answers come back from the review file. Merging deletes captured lessons and is hard to reverse.
2. **The review file is the only report.** No suggestion set in chat, no summary that duplicates the blocks. Chat carries the path and the counts.
3. **Every block is scored.** A block with no `**Fast-win:**` line has no place in the order, and the order is what makes the file readable.
4. **Autocreated first.** Target `metadata.origin: self-improvement` skills; touch hand-authored ones only on explicit request.
5. **Cluster before judging.** No suggestions from a flat list — group by trigger first.
6. **Deep read before merging.** Never suggest a unite/move on descriptions alone — read the full bodies + aux files first. A shared trigger is a hypothesis; the body confirms or kills it, and names the content the merge must preserve.
7. **No silent loss.** Every prune/unite states which rules disappear and why. A merged skill's content survives in the survivor.
8. **Widen the survivor's trigger.** When uniting, the surviving `description` must cover every folded-in trigger, or the merge silently disables a path.
