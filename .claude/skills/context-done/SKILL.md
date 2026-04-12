---
name: context-done
description: This skill should be used when the user says "work done", "context done", "task done", "finish task", "complete task", "close task", or indicates they have finished working on an active task. Summarizes task insights and distributes them to each repo's insight folder.
---

# Context Done

Finalize current work context: summarize collected insights and distribute to each related repo's insight folder.

## Usage

`/context done` — complete the current active task
`/context done <task-name>` — complete a specific task

## Configuration

Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter. If the file is missing, stop and ask the user to create it with the required settings (see plugin README).

## Command visibility and wiring checks

Run these checks when user reports "command not visible" or asks "for Claude?":

1. **Pi skill visibility**: ensure `~/.pi/agent/skills/context-done/SKILL.md` exists (usually symlinked to this file).
2. **Claude command visibility**: ensure a Claude command file exists under `harness/plugins/work-manager/claude/commands/` and that it explicitly instructs invoking `context-done`.
3. If Claude command is missing, do not claim the skill is available from Claude slash commands; state that only direct skill invocation works until command wiring is added.

## Procedure

### Step 1: Collect current work insights

1. Read recent session context and work notes provided by the caller
2. Extract concrete insights with repo relevance (`repo`, file paths, commands, config keys)
3. If artifacts are sparse, still produce concrete repo-ready notes from available facts

### Step 2: Generate summary

Create a concise task summary (3-5 sentences max):
- What the task was about
- Key decisions made
- Important findings or patterns discovered

### Step 3: Distribute to repo insight folders

For each unique repo in the task's `Repos` list:
1. Read `<insights_root>/<repo>/insights.md` first
2. **Deduplicate**: skip if an existing entry already covers the same knowledge (same topic heading, semantic overlap, or broader superset). If the new summary is a broader version of an existing entry, replace it.
3. Append to `<insights_root>/<repo>/insights.md`:
   ```
   ## <work-title> (work summary) — YYYY-MM-DD HH:MM
   <summary focusing on insights relevant to this specific repo>
   ```
4. Create the repo directory if it doesn't exist

### Step 4: Finalize

1. Confirm insight distribution completed for each affected repo
2. If this run was triggered by a work-completion flow that requires cleanup, explicitly instruct the caller to remove local temporary planning notes (for example project `_notes/`) **after** insight distribution succeeds

## Output

Report:
- Task name and summary
- Which repo folders received insights
- Confirmation that task is marked done

## Autoresearch rules

**Eval checklist:**
1. Were insights distributed to every repo's insight folder that was touched during the task?
2. Does each saved insight contain a concrete fact (file path, command, config value) — not a vague summary?
3. Was the task summary written before distribution (not skipped)?
4. Did the skill read the insights_root config before attempting any file writes?

**Test inputs:**
- "Complete a task that touched 3 repos with debugging discoveries in each"
- "Complete a task with no significant insights worth saving"
- "Complete a task when insights_root config is missing"

**Can change:** summary format, distribution logic, insight deduplication, task finalization steps
**Cannot change:** insights_root config requirement, per-repo distribution, task completion semantics
**Min sessions before eval:** 5
**Runs per experiment:** 3
