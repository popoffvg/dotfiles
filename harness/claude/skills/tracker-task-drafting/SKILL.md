---
name: tracker-task-drafting
description: Drafting a batch of tracker tasks (Notion/Jira/Linear/GitHub issues) for the user to review before creating them. Use when asked to prepare/draft tasks, a task list, or tickets from an investigation or a set of findings.
---

Draft each task to survive alone in the tracker. Tasks are created as independent pages — anything not in the task body is lost.

## Rules

- **Self-contained per task.** Inline every task's context in its own body. No shared preamble/header the tasks depend on, no cross-references between tasks ("see task 1", "the repro above"). If two tasks need the same context, repeat it in both.
- **Deliver the artifact, not a task about it.** When a batch item is itself a concrete deliverable — a BDD scenario, a spec, a test, a config — produce the actual artifact file, not a tracker task describing one to write. Only the genuinely open work becomes a task.
- **Attach supporting artifacts by filename.** Each task lists the files it needs (profiles, dumps, reports, scenarios) by exact filename, with the one command to open each. Move artifacts out of ephemeral/scratchpad paths into durable storage first, so the references still resolve after the session clears.

## Delivery

Draft to an editable file for per-task review (see the `to-user` skill), one block per task with an `**Answer:**` slot. Create the tracker pages only from the kept answers — never push to the tracker before the user confirms.
