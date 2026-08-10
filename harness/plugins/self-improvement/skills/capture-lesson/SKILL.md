---
name: capture-lesson
description: >
  Turn every captured lesson into a skill — extend an existing skill whose
  trigger already covers it, or write a new one. Use after a user correction,
  after the user states how they want a task done or how work is done in this
  repo, or after you learn something non-obvious from docs during the task.
---

A lesson worth keeping lands in a skill — never as a loose rule in a config or instruction file. A lesson not worth keeping is **skipped**, not filed somewhere weaker.

Run per lesson: **(0) name the source**, **(1) pick the scope — or skip**, **(1a) pick the container**, **(1b) pick the form**, **(2) find an existing skill for that trigger**, **(3) extend it or write a new skill**, **(4) record the case**, **(5) report in one sentence or stay silent**.

# Step 0 — Name the source: correction, method, discovery, or decision

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

# Step 1a — Pick the container: a skill is the last resort

**Name the trigger, then pick the cheapest container that fires on it.** A skill's `description`
is resident in every session and fires only when the model notices it. A lesson whose trigger is
a command, a path, or a committable file gets a container that fires with certainty and costs no
resident context.

| The trigger is | Container | Where |
|---|---|---|
| A shell command shape | `PreToolUse` hook, matcher `Bash` — block with the reason, or allow when the state is safe | `harness/claude/hooks/` + `settings.json` |
| A command's aftermath | `PostToolUse` hook — put the real evidence into context | same |
| Touching certain files | a skill with `paths:` frontmatter, so it loads only on those edits | the skill itself |
| The shape of a committed file | a `pre-commit` job | `lefthook.yml` |
| Always true, no trigger | the output style or `CLAUDE.md` | `harness/claude/` |
| One project's fact, no rule attached | `mem_save` | engram |
| How a *request* should be read | a skill | Step 2 |

Only the last row earns a skill. Prefer extending an existing hook over adding one: a second
matcher in a hook that already parses `git` subcommands is cheaper than a new file.

A hook needs a test before it is wired. Feed it a synthetic payload for the case it must catch
**and** for the neighbouring case it must not, and confirm both exit codes. A hook that blocks a
legitimate command is worse than the lesson it encodes.

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
2. **`description`** = the if/when trigger, and the load-bearing field. [[authoring-model-invocable-skills]] owns how to write one and which invocation frontmatter to set; follow it instead of re-deriving the rules here.
3. **One lesson, one trigger.** A `description` covering unrelated situations fires on everything and sharpens nothing. Split rather than widen.
4. **Verify the anchor exists first.** A lesson pinned to a file, flag, or workflow that is already gone is not worth a skill.
5. **`paths:`** — scope activation when the trigger is "touched these files" (e.g. an LLM-config check on the config files). The skill then auto-fires only on relevant edits.
6. **Origin marker** (below). Before finishing, re-read the frontmatter and confirm the stamp is there — an unstamped autocreated skill is invisible to [[dream]] and never gets pruned or merged.

# Step 4 — Record the case in `CASE.md`

Every skill this skill touches — new or extended — gets a sibling `CASE.md` next to `SKILL.md`. Append one entry per case; never rewrite an earlier entry. **No `CASE.md`, no skill** — writing the rule without its case is the failure this step exists to prevent.

## Entry template

```markdown
## <YYYY-MM-DD> — <one-line case title>

- **Repo:** <repo path, or `machine` / `none`>
- **Source:** <correction | method | discovery> — <Step 0>
- **Task:** <what was being done when the user spoke>
- **What I did:** <correction: the wrong action, concretely — the command, the edit, the claim | method: what I was about to do, or the default I would have used>
- **User's words:** > <verbatim — never paraphrased; for a `discovery`, the doc/source passage that settled it>
- **Evidence:** <file:line, command output, or doc URL that settled it — `none` for a method the user simply stated>
- **Ambiguous?** <no — one right answer | yes — the other branch is right when …>
- **Scope chosen:** <project:<repo> | global | machine-scoped global> — <which row of the Step 1 table, and why>
- **Rule written:** <verdict | check> — <the one-line rule, or the new bullet added to an existing skill>
- **Transcript:** <the archived `.jsonl` path — printed by `${CLAUDE_PLUGIN_ROOT}/scripts/archive-transcript.sh`, or already known when [[dream]] calls this skill>
- **Session topic:** <the `Topic:` line from the transcript's `.env.md` sidecar>
```

Fill `Repo:` from the sidecar's "Projects in context" table, not from the cwd you happen to be in. A session that moved between repos has several rows; name the one whose files the correction was about, and list the others — a correction that spans two repos is the ≥2-repos evidence Step 1 looks for.

## Rules for `CASE.md`

1. **Name the repo even at global scope.** "This came from `~/git/pl`" is what makes [[dream]]'s ≥2-repos generalization test checkable next time.
2. **On extend (Step 3a), append to the existing skill's `CASE.md`** — a second case in the same file is the evidence that promotes a project rule to global.

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

Never stamp a hand-authored skill.
