---
name: lessons
description: >
  Report the session archive the self-improvement scan has collected — what the
  backlog is made of, which clusters it falls into, and what /dream would work on
  next. Use when the user asks what lessons the scan stored, what the statusline
  lesson count is made of, or which lessons are worth harvesting. Building a
  course or study guide out of a document corpus is the loose `lessons` skill,
  not this one.
---

The scan archives a transcript for every session it scores at or above the keep threshold. This skill reports that archive and writes nothing to it — capturing is [[capture-lesson]], harvesting is [[dream]].

**Report the pile by its shape, never row by row.** The backlog runs to dozens of lessons, most of them duplicates of each other or pointers at files that no longer exist. A row dump hides both. Rules for the prose: [[i-have-adhd]].

# Step 1 — Count the archive

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/lessons-list.sh --pending   # what /dream still owes
${CLAUDE_PLUGIN_ROOT}/scripts/lessons-list.sh --harvested # already a skill
```

Columns: `SCORE` (the scan's 0–10 guess) · `STATUS` · `SCOPE` (`global` transfers past this repo, `project` does not) · `DATE` · `TITLE` · `SESSION` (the key to every file in Step 4) · `VERDICT` (`covered`, `extend`, `doc`, `new-skill`, or `-` before the suggestion pass ran).

Done when you have both counts. Print the rows only when the user asks for rows.

# Step 2 — Cluster the pending lessons

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/lessons-dump.sh /tmp/lessons-dump.txt
```

One line per pending lesson: id, score, verdict, the lesson in one sentence, and the target file the scan proposed — all from the suggestions already on disk, so no pass reads a transcript.

Spawn three subagents over that one file, each with its own lens, each writing its report to a path you name ([[minions]] — a background agent returns a file, not a message):

| Lens | Question | Report to |
|---|---|---|
| **area** | Which part of the harness does the lesson land in? Cluster by target file and subject. | `/tmp/cluster-area.md` |
| **habit** | Which recurring mistake does it correct? Name the habits with 5+ sessions behind them. | `/tmp/cluster-habit.md` |
| **audit** | Which lessons duplicate each other, which targets repeat, which `covered` verdicts are too cheap, and which rows are dead weight? Check every target path on disk. | `/tmp/cluster-audit.md` |

Give each the dump path, the suggestions dir (`~/.claude/self-improvement/suggestions/<id>.md`) for resolving a vague line, and the rule that a `(no suggestion pass)` line carries only a title and counts as weak evidence.

Done when all three files exist and you have read them.

# Step 3 — Report

In this order, and nothing else:

1. **The process**, as the pipeline with its live numbers — sessions scored, kept, suggested, harvested, pending. `${CLAUDE_PLUGIN_ROOT}/scripts/scan-plan.sh` and `log/scan.log` say whether the scan is caught up. Name which stage is the bottleneck; it is the manual one.
2. **The clusters**, biggest first, each a count and one sentence. Both lenses — where lessons land, and which habit they correct.
3. **The audit**: duplicate groups, targets that repeat, and dead weight with the reason (stale path, invented target, untitled, already built).
4. **The honest backlog** — what is left after the duplicates collapse and the dead weight is dropped. That number, not the row count, is the work.

# Step 4 — Go deeper on one row, when asked

The session id is the key to all three files:

- `~/.claude/self-improvement/lessons/<scope>/<date>-<title>-<id>.jsonl` — the transcript, with a `.env.md` sidecar naming the topic and the repos in context. Read the sidecar first; it is a few lines.
- `~/.claude/self-improvement/suggestions/<id>.md` — where the scan thought the lesson belongs.
- `~/.claude/self-improvement/sessions/<id>.json` — score, scope, and the one line of reason behind them.

For the human prompts alone: `${CLAUDE_PLUGIN_ROOT}/scripts/human-turns.sh <transcript>`.

# Rules

1. **Report, never harvest.** Writing the skill is `/dream` — it holds the gates and the review file.
2. **`harvested` is decided by the directory**, not the record: a harvested transcript sits in `lessons/harvested/`, while the record's `archive` field still names where it used to be.
3. **Check a target path before repeating it.** The scan proposes targets it never verified, and some name skills that were dropped, renamed, or never existed.
4. **An empty archive is an answer.** Say the scan has kept nothing yet instead of looking for a second source.
