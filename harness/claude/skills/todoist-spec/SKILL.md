---
name: todoist-spec
description: Todoist spec layout — one spec becomes one Todoist project with state sections, one task per TODO, and `decision` tasks, driven with the `td` CLI. Use for "put this spec in Todoist", "plan this in Todoist", "organize spec work in Todoist", "use Todoist with /code".
---

# todoist-spec — one spec, one Todoist project

Run every command with the `td` CLI. The [todoist-cli](../todoist-cli/SKILL.md) skill owns the exact flags.

| Spec item | Todoist object |
|---|---|
| Mission or large goal | Parent project |
| One spec (one change in flight) | Project under the parent |
| Spec text | Project description: one link to `.notes/spec.md` |
| Spec state | Task `SPEC: <name>` in the project |
| Work state | Section: `Spec`, `Spec review`, `Ready`, `In Progress`, `In Review`. Done is a completed task. |
| Phase or increment | Label `phase-<name>` |
| TODO-N | Task `TODO-N: <outcome>` |
| Increment with its own PR | Subtask |
| Open decision | Task with the label `decision` |
| ADR | Repo file (`docs/adr/` or `.notes/adr/`), linked from the project description |

A spec text MUST have one home. The project description and the task descriptions link to `.notes/` files and copy no spec text.

Todoist has no Git sync. A task MUST change section or close only by a `td` command you run.

A spec run through the wm `/code` flow (`new`, `todo`, `impl`, `auto`) MUST move its tasks as `references/codeflow.md` says.

A repo whose `CLAUDE.md` names another tracker (Linear, GitHub Issues) MUST NOT get a Todoist project until the operator says which tracker wins.

## 1. Find the home

Run `td project list --search "<spec name>"` and `td project list` for the parent project. Ask the operator when no parent project matches.

**Completion criterion**: the parent project is named, and either no project for this spec exists or you update the one that does.

## 2. Create the project

Run `td project create --name "<spec name>" --parent "<parent>" --description "<text>"`. The description MUST hold the goal and the reason in one sentence, the acceptance criteria (how the operator checks the result), and the absolute path of `.notes/spec.md`. `.notes/` is not in git, so a repo-relative path does not resolve.

**Completion criterion**: the project URL exists and its description has the acceptance criteria.

## 3. Add the sections and the spec task

Run `td section create --project "<spec name>" --name <section>` once per section, in the order of the table. Add the task `SPEC: <spec name>` in the section `Spec`, or in `Spec review` when the spec has `status: review`.

**Completion criterion**: `td section list "<spec name>"` shows the five sections in order.

## 4. Create the tasks

Run `td task add` once per TODO, with `--description` that holds the TODO's Outcome, Acceptance, and the path of the TODO file. The agent half stays in `.notes/`. Put the TODO tasks in `Ready` when no question is open, else in `Spec`. Write each task ID into the human half of its TODO file. Run `td label list --search decision` and create the label `decision` when it is missing. Add one `decision` task per open question, in the section `Spec`.

**Completion criterion**: every TODO and every open question has one task, and each TODO task has its `phase-<name>` label when the spec has phases.

## 5. Report

Give the operator the project URL, the count of TODO tasks and `decision` tasks, and the open `decision` tasks. A spec is `Ready` only when no `decision` task is open. Tell the operator to open the project in board view, so the sections show as columns.

**Completion criterion**: the operator has the URL and the list of open decisions.
