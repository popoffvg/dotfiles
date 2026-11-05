---
name: dream
description: >
  Consolidate the accumulated skill corpus — global (~/.claude/skills) and
  project (.claude/skills). Run periodically to prune dead rules, unite
  overlapping ones, and generalize the over-specific. The complement to
  capture-lesson: that skill captures, this one consolidates.
disable-model-invocation: true
---

Consolidate the skill corpus that capture-lesson accumulates. That skill routes each new lesson *down* into the cheapest container that enforces it. `dream` walks the corpus *up*: the inverse pass. Run on demand (`/dream`), not automatically.

Before consolidating, `dream` also harvests the sessions the background scan scored high but never turned into lessons — see Step 0 below. Every candidate from both halves — harvest and consolidation — carries a **fast-win score** (below) and reaches the operator as one editable review file written through the `to-user` skill. Four consolidation operations, all suggested for review before any write:

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

# Step 0 — Harvest the judged sessions

The background scan (driven by the SessionStart hook) runs three stages per session and writes each result next to the record `~/.claude/self-improvement/sessions/<session-id>.json`:

1. **Score** (`capture-lesson:references/score.md`, haiku, typed prompts only): 0–10, a scope, one line. A score at or above the keep threshold copies the transcript to `lessons/<scope>/`.
2. **Suggestion** (`capture-lesson:references/suggest.md`): one reader's draft target, from the typed prompts and the skill inventory.
3. **Cause verdicts** (`scripts/judge-session.py`, the prompts in `references/trace.md`, `references/judge.md`, `references/replay.md`): the trace finds, per correction, the defect, the input the agent followed, and the harness producer of that input. The strict judge rejects a cause unless six gates pass with quoted evidence. The replay checks each accepted note against its own defect. Output: `verdicts/<session-id>/`.

`dream` adds the cross-session view and turns the verdicts into review blocks:

1. **Run the week stage.** `${CLAUDE_PLUGIN_ROOT}/scripts/judge-week.py --since <date of the last dream run>`. It judges the producer groups (2+ causes from one harness producer, across sessions), checks which later corrections each final note would have prevented, and prints the path of `verdicts/week-<since>/report.md`. Read the report.
2. **One block per final note.** A final note is an ACCEPT whose replay catches its own defect. The block carries the note's title, body, and `Not for` line, the container and target the judge named, the corrections it quotes, and the replay verdicts. Read the target file before you propose the edit: a target changed since the verdict can already hold the rule.
3. **One block per rule that exists and did not fire.** The report lists them under "Rules that exist and did not fire", with a status from the git date of the rule: `broken` (older than the first correction) or `unknown`. A rule that entered git after the correction is only counted: the session already fixed it. The rule text is not the fix. Propose a stronger container for it from `capture-lesson` Step 1a (a hook, a gate check, `paths:` frontmatter), or a `description` rewrite when the health rollup marks the skill `UNTRIGGERED`.
4. **Read the `.env.md` sidecar** of each session behind a block. It names the repos that were in context, which decides a `project-pattern` target.
5. **Score each block.** Harvest anchors for the fast-win score: a cause with 2 or more corrections is impact 4 at minimum; an `extend` of an existing file is effort 1–2; a new container with an untested trigger is effort 3 and up; impact is per-session frequency, not severity. A session with no verdict dir (scored before the cause stage existed) gets `judge-session.py <session-id>` first, at about $2 and 3 min each; name the count in the review file header before you run it.
6. **Move the transcript only after its block is approved and applied.** Run the rest of `capture-lesson` on the approved block, then move the `.jsonl` and its `.env.md` into `~/.claude/self-improvement/lessons/harvested/`, so a transcript is never harvested twice.
7. **Count the harvest** for the review file header — sessions judged, causes, final notes, rules that did not fire, the cost from the report, and which repos they came from (from the sidecars).

Then continue to the consolidation flow. Its suggestions and the harvest blocks go into **one** review file, ordered together by fast-win.

# Step 0.5 — Read the health rollup

Regenerate `~/.claude/self-improvement/health/rollup.json` (`${CLAUDE_PLUGIN_ROOT}/scripts/health-rollup.py --days 90`) — per-skill usage and failure counts extracted from every transcript before Claude Code's 30-day cleanup deletes it. Seed the consolidation with three of its fields:

- **`bucket: DEAD`** — installed and enabled, zero invocations in the window → prune candidates, ranked by `tokens` (always-resident listing cost). Events reach back only to when collection started, so a DEAD verdict younger than the window is weak — say so in the suggestion.
- **`bucket: BROKEN`** and the `ghost_skills` rows marked `BROKEN` — a name that still errors → rename or re-point suggestions: something refers to a skill that moved. Rows marked `PROJECT_SCOPED` are a repo's own skill reached from another repo, and `DISABLED` is `skillOverrides` doing its job; neither is a defect and neither is prunable.
- **`bucket: UNTRIGGERED`** — `by_human` above zero while `by_model` stays zero: the human reaches for the skill by name and the model never picks it up. The rule is wanted, so this is never a prune. It is a `description` that fails to name the situations the skill is for, and the fix is rewriting that trigger against the sessions where the human had to ask. Skills declaring `disable-model-invocation` are exempt, being human-entry points by design.
- **`interrupt_follow` / `ask_follow`** high relative to `uses` — the skill fires but fights the user. Open the transcript before suggesting anything: a skill whose job *is* interviewing scores here by working, so the count only says which transcript to read.

# Flow

1. **Gather.** Collect every rule across scopes, at two granularities:
   - **whole skills** — `~/.claude/skills/*/SKILL.md`, `<repo-root>/.claude/skills/*/SKILL.md`. Read frontmatter `name` + `description` first; that is the trigger and where cross-skill overlap shows.
   - **rules inside a skill body** — a SKILL.md usually bundles several rules (bullet list, numbered steps, sub-sections). Each is a unit dream can prune/unite/generalize on its own, or **move** to a skill whose trigger fits it better. Read bodies for any skill that enters a candidate cluster.
   - **aux files** — a skill may carry `references/*.md`, `GLOSSARY.md`, or helper scripts beside SKILL.md. These hold rules too; include them in a deep read (step 4).

Read in escalating depth — cheap first, deep only where it pays: **descriptions** (all skills) → **bodies** (cluster members) → **aux files + linked docs** (unite/move candidates).

2. **Frame targets by origin.** Autocreated skills carry `metadata.origin: self-improvement` (stamped by `capture-lesson`). Those are the prime targets — fine-grained, single-lesson, prone to overlap. Leave hand-authored skills (no marker) alone unless the user says otherwise. Note in each suggestion whether the target is autocreated.

3. **Cluster.** Group rules whose triggers overlap or share a theme. Overlap is invisible in a flat list of many skills — clustering is the load-bearing step. A cluster of one is fine (a lone prune candidate). Clustering off descriptions is a *hypothesis* — a shared trigger is not yet a confirmed overlap.

4. **Deep read (confirm before suggesting a merge).** For every unite/move candidate cluster, read the **full body of each member plus its aux files** before proposing the operation. A trigger match can hide two genuinely different jobs (an interactive-debugger guide vs a test-failure workflow both fire on "debug"), and a body carries unique content a merge must not drop (a programmatic API absent from the CLI-only sibling). From the deep read, decide: (a) is the overlap real, or do the skills split on backend/purpose? (b) which member is the sharper **survivor**? (c) what unique content from the losers must survive the merge? Record these in the suggestion. Skip deep read only for pure prunes (dead-anchor) — everything that merges or moves rules requires it.

5. **Per cluster, emit suggestions.** For each cluster produce prune / unite / generalize / move suggestions, each with: the target rules (paths), the operation, a one-line reason, its fast-win score, and — for unite/move — the survivor and the unique content to preserve (from step 4). Concrete — name the files, quote the overlapping triggers.

6. **Review gate — write the file, do not present it in chat.** Run the `to-user` skill over the whole set, harvest blocks and consolidation suggestions together, with four `dream` specifics:

   - The file is `dream-decisions.md`, in the notes dir of the repo the session runs in, or the scratchpad when there is none.
   - **One order: fast-win, highest first.** Not grouped by operation — the operator reads down and stops when they run out of attention, and what they read first is what pays most.
   - Every block carries the `**Fast-win:**` line under **Detail**, and **Recommended** is pre-filled into the `**Answer:**` slot. Leaving a block alone accepts it; `no` rejects it.
   - A header line stating that nothing is written until answers come back, and the harvest count from Step 0.7.

7. **Apply approved.** For each approved suggestion:
   - **prune** → delete the skill dir, or remove the single rule from the body.
   - **unite** → merge bodies into the surviving skill (widen its `description` to cover both triggers), delete the losers.
   - **generalize** → write the broader rule, delete the specifics it subsumes.
   - **move** → cut the rule from the source body, paste into the target skill; widen the target's `description` if the moved rule adds a trigger. If the source body empties, prune the source skill.
   Preserve the origin marker on survivors. Edit and delete in `harness/claude/skills/` — a global skill lives there and reaches `~/.claude/skills` as a stow symlink, so deleting the link leaves the source and the skill returns on the next stow. Run `mise run stow` after a prune or a rename.

# Detection heuristics

- **prune** — `description`/body names a file, flag, path, or workflow; verify it still exists (`find` / `grep`). Gone → prune. Also prune a rule fully subsumed by a broader sibling.
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
