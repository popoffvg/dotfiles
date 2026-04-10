---
name: context-done
description: This skill should be used when the user says "work done", "context done", "task done", "finish task", "complete task", "close task", or indicates they have finished working on an active task. Summarizes task insights and distributes them to each repo's insight folder.
---

# Context Done

Finalize an active task: summarize collected insights and distribute to each related repo's insight folder.

## Usage

`/context done` — complete the current active task
`/context done <task-name>` — complete a specific task

## Configuration

Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter. If the file is missing, stop and ask the user to create it with the required settings (see plugin README).

## Procedure

### Step 1: Find the active task

1. Read `<insights_root>/_tasks/pending.md`
2. Find the task with **Status: active** (or match by name if provided)
3. If no active task found, tell the user and stop

### Step 2: Collect task insights

1. Read `<insights_root>/_tasks/<task-slug>/notes.md`
2. Extract all insights with their repo tags (`_(repo: <name>)_`)
3. Read the task description from `pending.md`

### Step 3: Generate summary

Create a concise task summary (3-5 sentences max):
- What the task was about
- Key decisions made
- Important findings or patterns discovered

### Step 4: Distribute to repo insight folders

For each unique repo in the task's `Repos` list:
1. Read `<insights_root>/<repo>/insights.md` first
2. **Deduplicate**: skip if an existing entry already covers the same knowledge (same topic heading, semantic overlap, or broader superset). If the new summary is a broader version of an existing entry, replace it.
3. Append to `<insights_root>/<repo>/insights.md`:
   ```
   ## <task-title> (task summary) — YYYY-MM-DD HH:MM
   <summary focusing on insights relevant to this specific repo>
   _(from task: <task-slug>)_
   ```
4. Create the repo directory if it doesn't exist

### Step 5: Archive the task

1. In `<insights_root>/_tasks/pending.md`, change the task's status from `active` to `done`
2. Keep `<insights_root>/_tasks/<task-slug>/` as-is (archive, don't delete)

## Output

Report:
- Task name and summary
- Which repo folders received insights
- Confirmation that task is marked done
