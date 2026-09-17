---
name: minions
description: Use for any task whose answer means reading many places and reporting back — extract, collect, check, audit, compare, find every, cross-check one set against another — or any ask to split the work up, run it in parallel, or keep the context clean.
argument-hint: [the task to farm out]
---

# minions

Run the task on the cheapest set of minions that still answers it. Two goals, in order: **the main context holds conclusions, never the reading**, then **each unit runs on the cheapest model that can do it**.

## 1. Cut into units

A unit is one deliverable, not one step: "audit these 12 files" is 12 units, "read the config then patch it" is one. Name three things per unit:

- **Deliverable** — the shape you want back: a verdict, a table, a path, a patch.
- **Input** — the files or command it must read. Count the volume: more than one file, or more than one screen, is heavy and belongs outside the main context.
- **Depends on** — the unit whose result it needs. None means it runs beside its siblings.

Done when every unit has all three.

## 2. Pick the shape — first row that fits

**A named agent owns its model; the table is for units with no agent of their own.** When a unit maps to an existing `subagent_type` — `wm:architector`, `wm:implementer`, any plugin agent — open its frontmatter and let its `model` stand. Override it only when you can name what about *this* unit makes the author's default wrong, and say that to the operator. "The table said `sonnet`" is not a reason.

**`model: inherit` is a choice, not a blank.** It means the author wants this unit on the orchestrator's model, and the agents that declare it are usually the ones that judge rather than type. Passing a cheaper model overrides that silently. So:

- Definition names a concrete model (`sonnet`, `haiku`) → repeat it on the call, so a dropped field cannot quietly buy opus.
- Definition says `inherit` → pass no `model` at all.

| The unit… | Shape | Model |
|---|---|---|
| is one tool call or one short edit | inline | current |
| reads a lot and reports a little — audit, summarize, triage, locate | one subagent | `haiku` |
| needs this conversation but its work would flood it | `subagent_type: "fork"` | inherited |
| has siblings with nothing between them | one subagent each, all in one message | `haiku` |
| writes source, judges a design, or holds the whole task | inline, or one subagent when the reading is heavy | `sonnet`; `opus` only after a cheaper run failed |

Parallel writers get disjoint write sets; when two could touch one path, give them `isolation: "worktree"` instead. Either way, run `git status --porcelain` afterwards and confirm every changed path belongs to a write set you handed out. Done when every unit names a shape and a model.

## 3. Write the prompt blind

A minion sees only what you type. In this order:

1. **The deliverable, first line.** "Return the file:line of every call site of `X`", not "look into X".
2. **The input, as paths.** Absolute paths, symbol names, the command to run — never "the file we discussed".
3. **The few facts it cannot see.** The decision already made, the constraint, the name to use. One line each.
4. **The return shape.** "Return one markdown table, columns: file, line, kind." Its last line is the return value, so make that line the table itself.
5. **The limits.** Read-only, stop after N files, spawn nothing further.

Then cut every line that does not reach the deliverable — a long prompt costs on each parallel copy. Done when the prompt would still work pasted into an empty session.

**Do the deterministic extraction yourself; hand the minion a finished file.** A cheap agent asked to both build a corpus and analyze it spends its run on the filter and returns nothing — a haiku run asked to do both produced 42,140 unfiltered lines and no report. Filter, grep, or script the corpus down first, then give the minion the finished file and its record count.

## 4. Report

Give the operator the verdicts, one line per unit, plus one line naming which model ran what. A `haiku` result that misses a field of the shape you asked for, or that a spot-check contradicts, re-runs on `sonnet` as a single unit — never as the whole fan-out. Re-check any count a minion reports before relaying it — a claim that does not survive the re-check is dropped, not softened.

**Read the model back before you report it.** What you passed is not proof of what ran. Each minion's own transcript records it, one file per agent:

```bash
ls ~/.claude/projects/<project-dir>/<session-id>/subagents/*.jsonl
```

Each `assistant` line carries `message.model`. The main session transcript holds only orchestrator turns, all `isSidechain: false` — grepping it shows your own model and nothing else, which reads as "everything ran on opus".

Six or more units, or any unit that writes: print the plan — unit, shape, model, deliverable — and let the operator correct it before the first minion starts.
