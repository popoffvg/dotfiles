---
name: capture-lesson
description: >
  Turn every captured lesson into a skill — extend an existing skill whose
  trigger already covers it, or write a new one. Use after a user correction,
  or after the user states how they want a task done, when the lesson
  generalizes beyond the current task.
---

A lesson worth keeping lands in a skill — **extend an existing skill**, or **write a new one**. Never leave it as a loose rule in a config or instruction file. A lesson not worth keeping is **skipped**, not filed somewhere weaker.

Run per lesson: **(0) name the source**, **(1) pick the scope — or skip**, **(1b) pick the form**, **(2) find an existing skill for that trigger**, **(3) extend it or write a new skill**, **(4) record the case**.

# Step 0 — Name the source: correction, method, or decision

Two kinds of user input become a lesson; the third is not a source at all.

| Source | What it looks like | Outcome |
|---|---|---|
| **correction** | You acted, the user said it was wrong | run Step 1 |
| **method** | The user stated how to do the task — before you acted, mid-task, or while reviewing output that was not wrong | run Step 1 |
| **decision** | The user chose for **this** task only: picked one of the options you offered, or set a value, with no reason given that reaches past this task | not a source — no skill |

A method has no failure attached, so nothing feels broken and the lesson gets dropped. Capture it anyway. Examples: "build the deck one section at a time and show me each one", "start from the outline, not the slides", "always name the source file next to the claim".

Treat as a method any statement of **how**, **in what order**, **in what shape**, or **with which tool** the user wants work done — including a preference they give while approving your output.

A `decision` becomes a `method` when the user gives the reason behind the pick, because the reason is what transfers to the next task. "Use option B" is a decision; "use option B — I want the source next to every claim" is a method.

Step 0 names the source and nothing else. A `correction` or a `method` always continues to Step 1, which decides scope on its own terms — Step 0 never argues for `skip`. Only `decision` stops here.

# Step 1 — Pick the scope

Judge **how often the situation recurs**, not whether the wording sounds portable. "Would this help on a different codebase?" always answers yes, because the lesson was already abstracted before the question ran — that gate passes everything and the corpus turns global by default.

The teachability test: **would you teach this rule to a student or a new colleague?**

| Test | Scope | Location |
|---|---|---|
| Yes — it is worth teaching someone new; the situation recurs and the rule stays useful | global | `~/.claude/skills/<slug>/SKILL.md` |
| No, but the situation is tied to **this** content — these files, this layout, this repo's tooling — and will come back here | project | `<repo-root>/.claude/skills/<slug>/SKILL.md` |
| Neither — a one-off that will not recur and teaches nobody | **skip** — write no skill |

Skip is a real outcome. A rule captured from a situation that never returns costs context on every future session and sharpens nothing.

A lesson can be teachable *and* anchored to this machine — a vault path, an MCP server, a CLI on `PATH`. That is still global; name the anchor in the body and say what to do when it is absent, so the skill degrades instead of hard-failing.

Write to `~/.claude` directly — never the dotfiles `harness/` source. Project root is `git rev-parse --show-toplevel`; if the cwd is not a git repo, the scope is global.

For a global skill, phrase the lesson generally and strip this project's names and paths. For a project skill, keep the real paths and commands — concreteness helps at project scope.

# Step 1b — Pick the form: verdict or check

Did the case have **one right answer**?

- **Yes** → write a **verdict**: the rule to apply ("route recursive search through the indexed tools").
- **No — it was a real trade-off** (delete-vs-rewire, new-field-vs-tighten-the-old-one, this framing vs that one) → write a **check**: the question to ask and the evidence to gather, with both branches and what tips between them.

A verdict written from an ambiguous case prescribes one branch as always-correct, then auto-fires on every case that merely looks similar — including the ones the other branch fits. It reads authoritative and is wrong half the time.

An ambiguous lesson has two homes: a check at global scope, or a verdict scoped to the repo where the trade-off does resolve one way. Never a verdict at global scope.

# Step 2 — Find an existing skill first

List the skills in the chosen scope and read the frontmatter `description` of each — that is the trigger. A lesson belongs to an existing skill when its situation is already inside that skill's `description`, or sits one clause away from it.

Extend, don't fork. A near-duplicate skill splits one trigger across two files, and [[dream]] has to merge it back later.

# Step 3a — Extend the existing skill

1. Add the lesson to the body, at the granularity the body already uses (a bullet in a bullet list, a step in a numbered procedure, a sub-section).
2. Widen the `description` only if the lesson adds a trigger the description does not already cover. A description that misses the new trigger silently disables the lesson.
3. Keep the existing origin marker; never stamp a hand-authored skill.

# Step 3b — Write a new skill

1. **Body** = the lesson: what to do, and the failure it prevents.
2. **`description`** = the if/when trigger — skills auto-load when their description matches the task. This is the load-bearing field; a lesson under a vague description never fires.
3. **`paths:`** — scope activation when the trigger is "touched these files" (e.g. an LLM-config check on the config files). The skill then auto-fires only on relevant edits.
4. **Invocation frontmatter** (verified vs code.claude.com/docs/en/skills.md):
   - Default (omit both) → Claude auto-invokes on match **and** the user can run `/slug`. Use for checks that should fire unprompted next time.
   - `disable-model-invocation: true` → user-only via `/slug`, never auto-fires. Use for deliberate or destructive actions (deploy, migrations).
   - `user-invocable: false` → hidden from the `/` menu, model-only.
5. **Origin marker** (below). Before finishing, re-read the frontmatter and confirm the stamp is there — an unstamped autocreated skill is invisible to [[dream]] and never gets pruned or merged.

Examples — global: "prefer composition over inheritance for X-shaped problems"; "default to table-driven tests"; "write commit subjects as `<prefix>: <why>`"; from a method — "when building a deck, write the outline first and confirm it before any slide". Project: "a `*-help` command prints its table verbatim — no preamble, no tool calls"; "a router SKILL.md gives every subcommand its own `references/<sub>.md`"; "when editing the LLM model config, verify token limits, pricing, and the model id against the claude-api skill before shipping".

# Step 4 — Record the case in `CASE.md`

Every skill this skill touches — new or extended — gets a sibling `CASE.md` at the skill root, next to `SKILL.md`. Append one entry per case; never rewrite an earlier entry.

The SKILL.md holds the rule stripped of its origin. `CASE.md` holds what the rule was abstracted *from*. Without it, nobody can later re-judge the scope, tell a verdict from a trade-off, or decide whether two skills came from the same failure — the evidence is gone and only the assertion remains.

## Entry template

```markdown
## <YYYY-MM-DD> — <one-line case title>

- **Repo:** <repo path, or `machine` / `none`>
- **Source:** <correction | method> — <Step 0>
- **Task:** <what was being done when the user spoke>
- **What I did:** <correction: the wrong action, concretely — the command, the edit, the claim | method: what I was about to do, or the default I would have used>
- **User's words:** > <verbatim — never paraphrased>
- **Evidence:** <file:line, command output, or doc URL that settled it — `none` for a method the user simply stated>
- **Ambiguous?** <no — one right answer | yes — the other branch is right when …>
- **Scope chosen:** <project:<repo> | global | machine-scoped global> — <which row of the Step 1 table, and why>
- **Rule written:** <verdict | check> — <the one-line rule, or the new bullet added to an existing skill>
```

## Rules for `CASE.md`

1. **Quote the user's words verbatim.** A paraphrase loses the trade-off; the user's exact wording is the primary evidence.
2. **Append, don't edit.** A skill that fires wrong and gets re-corrected accumulates a second entry. The sequence is the record of how the rule evolved.
3. **Name the repo even at global scope.** "This came from `~/git/pl`" is what makes the ≥2-repos test in Step 1 checkable next time.
4. **On extend (Step 3a), append to the existing skill's `CASE.md`** — a second case in the same file is the evidence that promotes a project rule to global.
5. **No `CASE.md`, no skill.** Writing the rule without its case is the failure this step exists to prevent.

[[dream]] reads `CASE.md` when judging prune/unite/generalize: two skills whose cases are the same incident are a unite candidate; a skill whose only case names a dead repo is a prune candidate; a skill with cases from several repos has earned generalization.

# Origin marker

Every skill this skill creates gets an origin stamp in its frontmatter:

```yaml
metadata:
  origin: self-improvement   # autocreated from a captured lesson
```

The marker separates autocreated skills (fine-grained, single-lesson, prime consolidation targets) from hand-authored ones. [[dream]] uses it to frame what to prune/unite/generalize and to leave hand-authored skills alone unless told otherwise. Never stamp a hand-authored skill.

# Rules

1. **A stated method is a lesson.** Do not wait for a correction. If the user said how they want a task done, run the same steps on it (Step 0).
2. **A kept lesson ends as a skill.** No loose rules in instruction or config files — and no skill for a lesson that failed the teachability test (Step 1). Kept or skipped, never half-filed.
3. **Extend before creating.** Check the existing triggers in scope first.
4. **One lesson, one trigger.** A skill whose `description` covers unrelated situations fires on everything and sharpens nothing.
5. **Trigger in the user's terms.** Describe how a *task* looks, not how the codebase looks: "when committing across multiple repos", not "when in a monorepo".
6. **Drop stale anchors.** A lesson pinned to a file, flag, or workflow that no longer exists is not worth a skill — verify the anchor exists first.
7. **Every rule carries its case.** `CASE.md` beside every `SKILL.md` this skill writes or extends (Step 4).
8. **Ambiguous case → check, never a global verdict.** (Step 1b.)

# Evals

The plugin's `evals/` (`${CLAUDE_PLUGIN_ROOT}/evals/`) grades the Step 0, Step 1, and Step 1b gates against labelled cases. Run `evals/run.sh` after changing any gate, and update `evals/cases.jsonl` in the same change when a gate's contract moves — a rubric left on the old contract grades against a superseded spec.

Adding a gate section regresses the others: Step 0 first cost two `project` cases, which turned `skip`, because "is this a source at all?" leaked into Step 1. Run the whole suite after adding one and read the `-v` rationale of every flip.
