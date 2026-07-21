---
name: dream
description: >
  Consolidate the accumulated rule corpus — global (~/.claude/skills), project
  (.claude/skills), and CLAUDE.local.md <task-relevant> blocks. Run periodically
  to prune dead rules, unite overlapping ones, and generalize the over-specific.
  The complement to improve-claude-local: that skill captures, this one consolidates.
disable-model-invocation: true
---

Consolidate the rule corpus that improve-claude-local accumulates. That skill routes each new lesson *down* the gates (global → project → memory) as a fine-grained piece. `dream` walks the corpus *up*: the inverse pass. Run on demand (`/dream`), not automatically.

Three operations, all suggested for review before any write:

- **prune** — drop a rule whose anchor is dead (file/flag/workflow gone) or that never fires. Applies to a whole skill or a single rule inside a body.
- **unite** — merge rules that share a trigger into the sharper one — whole skills, or bullets within one body.
- **generalize** — lift an over-specific rule (or a cluster of near-duplicates) into one broader rule that subsumes them.
- **move** — relocate a rule from a skill whose trigger no longer fits it to one that does (a rule bundled in the wrong skill).

# Flow

1. **Gather.** Collect every rule across scopes, at two granularities:
   - **whole skills** — `~/.claude/skills/*/SKILL.md`, `<repo-root>/.claude/skills/*/SKILL.md`. Read frontmatter `name` + `description` first; that is the trigger and where cross-skill overlap shows.
   - **rules inside a skill body** — a SKILL.md usually bundles several rules (bullet list, numbered steps, sub-sections). Each is a unit dream can prune/unite/generalize on its own, or **move** to a skill whose trigger fits it better. Read bodies for any skill that enters a candidate cluster.
   - **aux files** — a skill may carry `references/*.md`, `GLOSSARY.md`, or helper scripts beside SKILL.md. These hold rules too; include them in a deep read (step 4).
   - CLAUDE.local.md `<task-relevant>` blocks — project (`git rev-parse --show-toplevel`) and global `~/CLAUDE.local.md`.

Read in escalating depth — cheap first, deep only where it pays: **descriptions** (all skills) → **bodies** (cluster members) → **aux files + linked docs** (unite/move candidates).

2. **Frame targets by origin.** Autocreated skills carry `metadata.origin: self-improvement` (stamped by [[improve-claude-local]]). Those are the prime targets — fine-grained, single-lesson, prone to overlap. Leave hand-authored skills (no marker) alone unless the user says otherwise. Note in each suggestion whether the target is autocreated.

3. **Cluster.** Group rules whose triggers overlap or share a theme. Overlap is invisible in a flat list of 80+ skills — clustering is the load-bearing step. A cluster of one is fine (a lone prune candidate). Clustering off descriptions is a *hypothesis* — a shared trigger is not yet a confirmed overlap.

4. **Deep read (confirm before suggesting a merge).** For every unite/move candidate cluster, read the **full body of each member plus its aux files** before proposing the operation. A trigger match can hide two genuinely different jobs (`go-debug` = interactive Delve vs `go-test-debug` = test-failure workflow), and a body carries unique content a merge must not drop (e.g. `gh-test`'s programmatic JS API absent from `act`). From the deep read, decide: (a) is the overlap real, or do the skills split on backend/purpose? (b) which member is the sharper **survivor**? (c) what unique content from the losers must survive the merge? Record these in the suggestion. Skip deep read only for pure prunes (dead-anchor) — everything that merges or moves rules requires it.

5. **Per cluster, emit suggestions.** For each cluster produce prune / unite / generalize / move suggestions, each with: the target rules (paths), the operation, a one-line reason, and — for unite/move — the survivor and the unique content to preserve (from step 4). Concrete — name the files, quote the overlapping triggers.

6. **Review gate.** Present the full suggestion set grouped by operation. One exchange. The user approves, rejects, or edits per suggestion. Do not write before approval — merging deletes captured lessons and is hard to reverse.

7. **Apply approved.** For each approved suggestion:
   - **prune** → delete the skill dir / remove the `<task-relevant>` block.
   - **unite** → merge bodies into the surviving skill (widen its `description` to cover both triggers), delete the losers. For blocks, merge into the sharper block, drop the other.
   - **generalize** → write the broader rule, delete the specifics it subsumes.
   - **move** → cut the rule from the source body, paste into the target skill; widen the target's `description` if the moved rule adds a trigger. If the source body empties, prune the source skill.
   Preserve the origin marker on survivors. After touching `~/.claude/skills`, no stow step is needed (skills are edited in place there); if editing dotfiles sources, run `mise run stow`.

# Detection heuristics

- **prune** — `description`/body names a file, flag, path, or workflow; verify it still exists (`mcp__fff__find_files` / `grep`). Gone → prune. Also prune a rule fully subsumed by a broader sibling.
- **unite** — two+ rules whose `when`/`description` triggers match the same task shape. Keep the sharper wording; fold the rest in.
- **generalize** — a cluster of rules that are the same principle at different anchors (e.g. several "verify X before Y" variants). Lift to one rule stated at the shared altitude; the specifics become examples, not separate skills.
- **move** — a bullet inside skill A whose subject matches skill B's `description` better than A's. Relocate it so each rule sits under the trigger that actually fires it.

# Rules

1. **Suggest before write.** Never prune/unite/generalize without the review gate. This is editorial and irreversible.
2. **Autocreated first.** Target `metadata.origin: self-improvement` skills; touch hand-authored ones only on explicit request.
3. **Cluster before judging.** No suggestions from a flat list — group by trigger first.
4. **Deep read before merging.** Never suggest a unite/move on descriptions alone — read the full bodies + aux files first. A shared trigger is a hypothesis; the body confirms or kills it, and names the content the merge must preserve.
5. **No silent loss.** Every prune/unite states which rules disappear and why. A merged skill's content survives in the survivor.
6. **Widen the survivor's trigger.** When uniting, the surviving `description` must cover every folded-in trigger, or the merge silently disables a path.
