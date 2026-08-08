---
name: capture-lesson
description: >
  Turn every captured lesson into a skill — extend an existing skill whose
<<<<<<< Updated upstream
  trigger already covers it, or write a new one. Use after a user correction
  that generalizes beyond the current task.
||||||| Stash base
  trigger already covers it, or write a new one. Use after a user correction,
  after the user states how they want a task done, or after the user states
  how work is done in this repo.
=======
  trigger already covers it, or write a new one. Use after a user correction,
  after the user states how they want a task done or how work is done in this
  repo, or after you learn something non-obvious from docs during the task.
>>>>>>> Stashed changes
---

A lesson worth keeping lands in a skill — never as a loose rule in a config or instruction file. A lesson not worth keeping is **skipped**, not filed somewhere weaker.

<<<<<<< Updated upstream
Run per lesson: **(0) triage the session**, **(0b) name the source**, **(1) pick the scope — or skip**, **(1b) pick the form**, **(2) find an existing skill for that trigger**, **(3) extend it or write a new skill**, **(4) record the case**, **(5) archive the transcript**.
||||||| Stash base
Run per lesson: **(0) name the source**, **(1) pick the scope — or skip**, **(1b) pick the form**, **(2) find an existing skill for that trigger**, **(3) extend it or write a new skill**, **(4) record the case**.
=======
Run per lesson: **(0) name the source**, **(1) pick the scope — or skip**, **(1b) pick the form**, **(2) find an existing skill for that trigger**, **(3) extend it or write a new skill**, **(4) record the case**, **(5) report in one sentence or stay silent**.
>>>>>>> Stashed changes

<<<<<<< Updated upstream
# Step 0 — Triage the session with a subagent

This step only runs when invoked directly as `/capture-lesson` on the live session — find the transcript at `~/.claude/projects/<cwd-with-slashes-as-dashes>/<session-id>.jsonl`. When [[dream]] calls this skill during its harvest step, the transcript is already archived and already known to contain a correction; skip straight to extracting candidates (dream's step 2) and go to Step 1 below.

Never read the session back yourself. Launch one subagent — `Agent` tool, `subagent_type: "self-improvement:triage"` — given the plugin root and the transcript path (see `agents/triage.md`). It returns `SKIP`, or `CATCHED <archived-transcript-path>` after archiving the transcript itself. It does not extract candidates — that judgment (does this correction recur?) and the write-up (verbatim quote, wrong action, evidence) are yours to do, reading `<plugin-root>/scripts/human-turns.sh <transcript>` and the surrounding context, the same way [[dream]]'s harvest step does for already-archived transcripts.

From the Stop hook, launch it with `run_in_background: true` — nothing there needs the verdict synchronously, so the user is never blocked on it. Run it with `run_in_background: false` when invoked directly as `/capture-lesson`: you need its verdict before Step 1 can proceed.

The Stop hook (`hooks/self-improve-stop.sh`) also launches this subagent on every session, but only to decide whether to archive — it never runs this skill live. `SKIP` there ends the run silently; `CATCHED` there just leaves the transcript archived for a later `/dream` pass. That keeps every Stop cheap: one haiku subagent, no scope/form judgment, no skill writes, regardless of how many sessions turn out interesting.

`SKIP` here ends the run: no skill, no `CASE.md`, no further archiving. Otherwise carry each surviving candidate through Steps 0b–5 separately.

# Step 0b — Name the source: correction, method, or decision

Two kinds of user input become a lesson; the third is not a source at all.
||||||| Stash base
# Step 0 — Name the source: correction, method, or decision

Two kinds of user input become a lesson; the third is not a source at all.
=======
# Step 0 — Name the source: correction, method, discovery, or decision
>>>>>>> Stashed changes

| Source | What it looks like | Outcome |
|---|---|---|
| **correction** | You acted, the user said it was wrong | run Step 1 |
| **method** | The user stated how to do the task — before you acted, mid-task, or while reviewing output that was not wrong | run the bar, then Step 1 |
| **discovery** | You read docs or ran an experiment, and what you found contradicted your default assumption or took real digging | run the bar, then Step 1 |
| **decision** | The user chose for **this** task only: picked one of the options you offered, or set a value, with no reason given that reaches past this task | not a source — no skill |

A method has no failure attached, so nothing feels broken and the lesson gets dropped. Examples: "build the deck one section at a time and show me each one", "start from the outline, not the slides", "always name the source file next to the claim".

Treat as a method any statement of **how**, **in what order**, **in what shape**, or **with which tool** the user wants work done — including a preference they give while approving your output.

A `decision` becomes a `method` when the user gives the reason behind the pick, because the reason is what transfers to the next task. "Use option B" is a decision; "use option B — I want the source next to every claim" is a method.

**A statement about how work is done in this repo is a method, with no reason needed** — the repo is the reason. This is where project lessons come from: ordinary instructions inside a working session, not corrections. "Run the generator before you edit the schema", "evals live at the plugin root", "we never edit the cached copy", "always stow, never write into `~/` directly". Nothing was wrong and no reason is attached, so these read like per-task decisions and get dropped.

**A discovery is what you learned, not what the user said.** The session forced you to read documentation, a spec, or source — or to run an experiment — because your default assumption was wrong or missing. Examples: a tool flag that behaves contrary to its name, an API constraint the docs bury, a hook field the platform feeds to the model rather than the user.

When the user's words triggered the capture, the source is the user's row — `correction` or `method` — even if you then read docs to settle the fix. `discovery` is only for a lesson no user statement produced.

## The bar: no override, no lesson

Every `method` and every `discovery` must clear one bar before Step 1. (A `correction` clears it by definition — the user acted to change your behavior.)

**Would future-you, without this capture, act wrongly or repeat the work?**

For a `method`:

- **No — the statement is the task itself.** What to build, which file, which bug, this deliverable's content. The next task brings its own spec. No lesson.
- **No — the statement matches your default.** You would have done it that way anyway. A rule that changes no behavior only costs context on every future session. No lesson.
- **Yes — it overrides your default.** A different order, shape, tool, or convention than you would have used. A lesson — continue to Step 1.

For a `discovery`:

- **No — one obvious lookup away.** The answer sat in `--help` or the first doc page, and you held no wrong assumption; you would just look it up again. No lesson.
- **No — it will not survive.** Version-pinned trivia that the next release invalidates (Step 3b verifies the anchor), or a fact the repo's own docs already record where you would look. No lesson.
- **Yes — it contradicted your default assumption, or took real digging.** Without capture you would make the same wrong assumption or repeat the excavation. A lesson — continue to Step 1.

**Novelty is not the bar.** A lesson an existing skill already covers still clears it and **extends** that skill at Step 2; the appended case is the promotion evidence (Step 4). `skip` is for lessons without value, not for lessons already filed.

Step 0 names the source and applies the bar. A `correction`, or a `method`/`discovery` that clears its bar, continues to Step 1, which decides scope on its own terms. A `decision`, or a `method`/`discovery` that fails the bar, stops here — no skill.

# Step 1 — Pick the scope

Judge **how often the situation recurs**, not whether the wording sounds portable. "Would this help on a different codebase?" always answers yes, because the lesson was already abstracted before the question ran — that gate passes everything and the corpus turns global by default.

The teachability test: **would you teach this rule to a student or a new colleague?**

| Test | Scope | Location |
|---|---|---|
| Yes — it is worth teaching someone new; the situation recurs and the rule stays useful | global | `~/.claude/skills/<slug>/SKILL.md` |
| No, but the situation is tied to **this** content — these files, this layout, this repo's tooling — and will come back here | project | `<repo-root>/.claude/skills/<slug>/SKILL.md` |
| Neither — a one-off that will not recur and teaches nobody | **skip** — write no skill |

Skip is a real outcome: a rule captured from a situation that never returns costs context on every future session and sharpens nothing.

A lesson can be teachable *and* anchored to this machine — a vault path, an MCP server, a CLI on `PATH`. That is still global; name the anchor in the body and say what to do when it is absent, so the skill degrades instead of hard-failing.

Write to `~/.claude` directly — never the dotfiles `harness/` source. Project root is `git rev-parse --show-toplevel`; if the cwd is not a git repo, the scope is global.

For a global skill, phrase the lesson generally and strip this project's names and paths. For a project skill, keep the real paths and commands — concreteness helps at project scope.

# Step 1b — Pick the form: verdict or check

Did the case have **one right answer**?

- **Yes** → write a **verdict**: the rule to apply ("route recursive search through the indexed tools").
- **No — it was a real trade-off** (delete-vs-rewire, new-field-vs-tighten-the-old-one, this framing vs that one) → write a **check**: the question to ask and the evidence to gather, with both branches and what tips between them.

A verdict written from an ambiguous case prescribes one branch as always-correct, then auto-fires on every case that merely looks similar — including the ones the other branch fits. It reads authoritative and is wrong half the time. Only a genuine trade-off earns a check; a case with one right answer is a verdict.

An ambiguous lesson has two homes: a check at global scope, or a verdict scoped to the repo where the trade-off does resolve one way. Never a verdict at global scope.

# Step 2 — Find an existing skill first

List the skills in the chosen scope and read the frontmatter `description` of each — that is the trigger. A lesson belongs to an existing skill when its situation is already inside that skill's `description`, or sits one clause away from it.

Extend, don't fork. A near-duplicate skill splits one trigger across two files, and [[dream]] has to merge it back later.

# Step 3a — Extend the existing skill

1. Add the lesson to the body, at the granularity the body already uses (a bullet in a bullet list, a step in a numbered procedure, a sub-section).
2. Widen the `description` only if the lesson adds a trigger the description does not already cover. A description that misses the new trigger silently disables the lesson.
3. Keep the existing origin marker.

# Step 3b — Write a new skill

1. **Body** = the lesson: what to do, and the failure it prevents.
<<<<<<< Updated upstream
2. **`description`** = the if/when trigger — skills auto-load when their description matches the task. This is the load-bearing field; a lesson under a vague description never fires.
3. **`paths:`** — scope activation when the trigger is "touched these files" (e.g. an LLM-config check on the config files). The skill then auto-fires only on relevant edits.
4. **Invocation frontmatter** (verified vs code.claude.com/docs/en/skills.md):
   - Default (omit both) → Claude auto-invokes on match **and** the user can run `/slug`. Use for checks that should fire unprompted next time.
   - `disable-model-invocation: true` → user-only via `/slug`, never auto-fires. Use for deliberate or destructive actions (deploy, migrations).
   - `user-invocable: false` → hidden from the `/` menu, model-only.
5. **Origin marker** (below). Before finishing, re-read the frontmatter and confirm the stamp is there — an unstamped autocreated skill is invisible to [[dream]] and never gets pruned or merged.

Examples — global: "prefer composition over inheritance for X-shaped problems"; "default to table-driven tests"; "write commit subjects as `<prefix>: <why>`". Project: "a `*-help` command prints its table verbatim — no preamble, no tool calls"; "a router SKILL.md gives every subcommand its own `references/<sub>.md`"; "when editing the LLM model config, verify token limits, pricing, and the model id against the claude-api skill before shipping".
||||||| Stash base
2. **`description`** = the if/when trigger — skills auto-load when their description matches the task. This is the load-bearing field; a lesson under a vague description never fires.
3. **`paths:`** — scope activation when the trigger is "touched these files" (e.g. an LLM-config check on the config files). The skill then auto-fires only on relevant edits.
4. **Invocation frontmatter** (verified vs code.claude.com/docs/en/skills.md):
   - Default (omit both) → Claude auto-invokes on match **and** the user can run `/slug`. Use for checks that should fire unprompted next time.
   - `disable-model-invocation: true` → user-only via `/slug`, never auto-fires. Use for deliberate or destructive actions (deploy, migrations).
   - `user-invocable: false` → hidden from the `/` menu, model-only.
5. **Origin marker** (below). Before finishing, re-read the frontmatter and confirm the stamp is there — an unstamped autocreated skill is invisible to [[dream]] and never gets pruned or merged.

Examples — global: "prefer composition over inheritance for X-shaped problems"; "default to table-driven tests"; "write commit subjects as `<prefix>: <why>`"; from a method — "when building a deck, write the outline first and confirm it before any slide". Project: "a `*-help` command prints its table verbatim — no preamble, no tool calls"; "a router SKILL.md gives every subcommand its own `references/<sub>.md`"; "when editing the LLM model config, verify token limits, pricing, and the model id against the claude-api skill before shipping".
=======
2. **`description`** = the if/when trigger, and the load-bearing field. [[authoring-model-invocable-skills]] owns how to write one and which invocation frontmatter to set; follow it instead of re-deriving the rules here.
3. **One lesson, one trigger.** A `description` covering unrelated situations fires on everything and sharpens nothing. Split rather than widen.
4. **Verify the anchor exists first.** A lesson pinned to a file, flag, or workflow that is already gone is not worth a skill.
5. **`paths:`** — scope activation when the trigger is "touched these files" (e.g. an LLM-config check on the config files). The skill then auto-fires only on relevant edits.
6. **Origin marker** (below). Before finishing, re-read the frontmatter and confirm the stamp is there — an unstamped autocreated skill is invisible to [[dream]] and never gets pruned or merged.
>>>>>>> Stashed changes

# Step 4 — Record the case in `CASE.md`

Every skill this skill touches — new or extended — gets a sibling `CASE.md` next to `SKILL.md`. Append one entry per case; never rewrite an earlier entry. **No `CASE.md`, no skill** — writing the rule without its case is the failure this step exists to prevent.

## Entry template

```markdown
## <YYYY-MM-DD> — <one-line case title>

- **Repo:** <repo path, or `machine` / `none`>
<<<<<<< Updated upstream
- **Task:** <what was being done when it went wrong>
- **What I did:** <the wrong action, concretely — the command, the edit, the claim>
- **Correction:** > <the user's words, verbatim — never paraphrased>
- **Evidence:** <file:line, command output, or doc URL that settled it>
||||||| Stash base
- **Source:** <correction | method> — <Step 0>
- **Task:** <what was being done when the user spoke>
- **What I did:** <correction: the wrong action, concretely — the command, the edit, the claim | method: what I was about to do, or the default I would have used>
- **User's words:** > <verbatim — never paraphrased>
- **Evidence:** <file:line, command output, or doc URL that settled it — `none` for a method the user simply stated>
=======
- **Source:** <correction | method | discovery> — <Step 0>
- **Task:** <what was being done when the user spoke>
- **What I did:** <correction: the wrong action, concretely — the command, the edit, the claim | method: what I was about to do, or the default I would have used>
- **User's words:** > <verbatim — never paraphrased; for a `discovery`, the doc/source passage that settled it>
- **Evidence:** <file:line, command output, or doc URL that settled it — `none` for a method the user simply stated>
>>>>>>> Stashed changes
- **Ambiguous?** <no — one right answer | yes — the other branch is right when …>
- **Scope chosen:** <project:<repo> | global | machine-scoped global> — <which row of the Step 1 table, and why>
- **Rule written:** <verdict | check> — <the one-line rule, or the new bullet added to an existing skill>
- **Transcript:** <path printed by Step 5>
- **Session topic:** <the `Topic:` line from the transcript's `.env.md` sidecar>
```

Fill `Repo:` from the sidecar's "Projects in context" table, not from the cwd you happen to be in. A session that moved between repos has several rows; name the one whose files the correction was about, and list the others — a correction that spans two repos is the ≥2-repos evidence Step 1 looks for.

## Rules for `CASE.md`

<<<<<<< Updated upstream
1. **Quote the correction verbatim.** A paraphrase loses the trade-off; the user's exact wording is the primary evidence.
2. **Append, don't edit.** A skill that fires wrong and gets re-corrected accumulates a second entry. The sequence is the record of how the rule evolved.
3. **Name the repo even at global scope.** "This came from `~/git/pl`" is what makes the ≥2-repos test in Step 1 checkable next time.
4. **On extend (Step 3a), append to the existing skill's `CASE.md`** — a second case in the same file is the evidence that promotes a project rule to global.
5. **No `CASE.md`, no skill.** Writing the rule without its case is the failure this step exists to prevent.

# Step 5 — Archive the transcript

Step 0 already made an interim safety copy (slug `session`) so the transcript survives rotation while triage and this skill run. Once a lesson is kept, replace it with the final, meaningfully-named copy:

```
${CLAUDE_PLUGIN_ROOT}/scripts/archive-transcript.sh <transcript> <case-slug>
```

It writes `~/.claude/self-improvement/lessons/<date>-<slug>-<session-id>.jsonl` plus a `<that path>.env.md` sidecar (session topic, and one row per git repo that was in context with its branch and origin remote), and prints the transcript path — put that path in the `CASE.md` entry. Delete the interim `session`-slugged `.jsonl` **and its `.env.md`** from Step 0 once this final copy exists, so the archive holds one pair of files per kept lesson.

Archive only sessions that produced a kept lesson. Skipped sessions keep no permanent archive entry, so every surviving file is the full evidence behind a skill, readable after the live transcript is compacted or rotated away. `SELF_IMPROVE_LESSONS_DIR` overrides the location.
||||||| Stash base
1. **Quote the user's words verbatim.** A paraphrase loses the trade-off; the user's exact wording is the primary evidence.
2. **Append, don't edit.** A skill that fires wrong and gets re-corrected accumulates a second entry. The sequence is the record of how the rule evolved.
3. **Name the repo even at global scope.** "This came from `~/git/pl`" is what makes the ≥2-repos test in Step 1 checkable next time.
4. **On extend (Step 3a), append to the existing skill's `CASE.md`** — a second case in the same file is the evidence that promotes a project rule to global.
5. **No `CASE.md`, no skill.** Writing the rule without its case is the failure this step exists to prevent.
=======
1. **Name the repo even at global scope.** "This came from `~/git/pl`" is what makes [[dream]]'s ≥2-repos generalization test checkable next time.
2. **On extend (Step 3a), append to the existing skill's `CASE.md`** — a second case in the same file is the evidence that promotes a project rule to global.
>>>>>>> Stashed changes

# Step 5 — Report in one sentence, or say nothing

| Outcome | Output |
|---|---|
| Nothing captured (skip, or no source) | **Say nothing.** No "no lesson found", no summary of what you considered. |
| One or more skills written or extended | **One sentence**, then stop. |

The sentence: what the skill is for, and its slug. Nothing else.

> Captured `return-a-summary-not-the-dataset` — hand back a summary, not the full dataset, across an agent boundary.

> Extended `filter-at-read-not-at-launch` with the workflow-return case.

Two skills, two sentences. Never a paragraph each.

**Never print:** the gate decisions (Step 0/1/1b/2 reasoning), a table of them, the file paths written, the `CASE.md` entry or any part of it, why the lesson was worth keeping, what you almost missed, or a second thought after the sentence. That reasoning belongs in `CASE.md`, which is where anyone re-judging the rule will look.

# Origin marker

Every skill this skill creates gets an origin stamp in its frontmatter:

```yaml
metadata:
  origin: self-improvement   # autocreated from a captured lesson
```

<<<<<<< Updated upstream
The marker separates autocreated skills (fine-grained, single-lesson, prime consolidation targets) from hand-authored ones. [[dream]] uses it to frame what to prune/unite/generalize and to leave hand-authored skills alone unless told otherwise. Never stamp a hand-authored skill.

# Rules

1. **A stated method that overrides your default is a lesson.** Do not wait for a correction. But a statement that merely restates the task, or matches what you would have done anyway, is not captured (Step 0 bar).
2. **Subject before teachability.** A rule whose subject is a named thing in one repo is project, however teachable it sounds (Step 1).
3. **A kept lesson ends as a skill.** No loose rules in instruction or config files — and no skill for a lesson that failed the teachability test (Step 1). Kept or skipped, never half-filed.
4. **Extend before creating.** Check the existing triggers in scope first.
5. **One lesson, one trigger.** A skill whose `description` covers unrelated situations fires on everything and sharpens nothing.
6. **Trigger in the user's terms.** Describe how a *task* looks, not how the codebase looks: "when committing across multiple repos", not "when in a monorepo".
7. **Drop stale anchors.** A lesson pinned to a file, flag, or workflow that no longer exists is not worth a skill — verify the anchor exists first.
8. **Every rule carries its case.** `CASE.md` beside every `SKILL.md` this skill writes or extends (Step 4), and the archived transcript behind it (Step 5).
9. **Ambiguous case → check, never a global verdict.** (Step 1b.)
10. **Never read a transcript yourself.** Triage runs in the haiku subagent (Step 0); the main agent starts from its candidates.

# Evals

The plugin's `evals/` (`${CLAUDE_PLUGIN_ROOT}/evals/`) grades the Step 1 and Step 1b gates against labelled cases. Run `evals/run.sh` after changing either gate, and update `evals/cases.jsonl` in the same change when the gate's contract moves — a rubric left on the old contract grades against a superseded spec.
||||||| Stash base
The marker separates autocreated skills (fine-grained, single-lesson, prime consolidation targets) from hand-authored ones. [[dream]] uses it to frame what to prune/unite/generalize and to leave hand-authored skills alone unless told otherwise. Never stamp a hand-authored skill.

# Rules

1. **A stated method that overrides your default is a lesson.** Do not wait for a correction. But a statement that merely restates the task, or matches what you would have done anyway, is not captured (Step 0 bar).
2. **Subject before teachability.** A rule whose subject is a named thing in one repo is project, however teachable it sounds (Step 1).
3. **A kept lesson ends as a skill.** No loose rules in instruction or config files — and no skill for a lesson that failed the teachability test (Step 1). Kept or skipped, never half-filed.
4. **Extend before creating.** Check the existing triggers in scope first.
5. **One lesson, one trigger.** A skill whose `description` covers unrelated situations fires on everything and sharpens nothing.
6. **Trigger in the user's terms.** Describe how a *task* looks, not how the codebase looks: "when committing across multiple repos", not "when in a monorepo".
7. **Drop stale anchors.** A lesson pinned to a file, flag, or workflow that no longer exists is not worth a skill — verify the anchor exists first.
8. **Every rule carries its case.** `CASE.md` beside every `SKILL.md` this skill writes or extends (Step 4).
9. **Ambiguous case → check, never a global verdict.** (Step 1b.)

# Evals

The plugin's `evals/` (`${CLAUDE_PLUGIN_ROOT}/evals/`) grades the Step 0, Step 1, and Step 1b gates against labelled cases. Run `evals/run.sh` after changing any gate, and update `evals/cases.jsonl` in the same change when a gate's contract moves — a rubric left on the old contract grades against a superseded spec.

Adding a gate section regresses the others: Step 0 first cost two `project` cases, which turned `skip`, because "is this a source at all?" leaked into Step 1. Run the whole suite after adding one and read the `-v` rationale of every flip.
=======
Never stamp a hand-authored skill.
>>>>>>> Stashed changes
