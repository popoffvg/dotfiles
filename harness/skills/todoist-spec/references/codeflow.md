# Todoist in the `/code` flow

Todoist holds the state of the work. `.notes/` holds the text of the work.

## Stage map

| `/code` stage | Notes state | `td` action | Todoist state |
|---|---|---|---|
| Idea | none | `td task add` in the Inbox, no project. | Inbox |
| `new` | spec `status: init` | Run the skill, steps 1–3: project, sections, `SPEC:` task. | `SPEC:` in `Spec` |
| grill | open question note in `thoughts/` | One `decision` task per open question. Complete it when its thought note is settled. | `decision` tasks open |
| the gate | spec `status: review` | Move the `SPEC:` task to `Spec review`. You read the spec. | `Spec review` |
| `todo` | `TODO-N` `status: todo` | Step 4: one task per TODO. Write the task ID into the TODO human half. | Tasks in `Ready` |
| `verify` | — | `td comment add` the verdict (READY or NEEDS REVISION) on the `SPEC:` task. NEEDS REVISION moves it back to `Spec`. READY completes it. | `Ready` or `Spec` |
| `impl` | `TODO-N` `status: impl` | `td task move id:<id> --section "In Progress"`. | `In Progress` |
| review gates, PR | `status: verify` | Open the PR with the task URL in the body. Move the task to `In Review` and comment the PR URL on it. | `In Review` |
| merge | `status: done` | The operator merges. When `gh pr view` shows the PR merged, run `td task complete id:<id>`. | Completed |
| `auto` | the whole ledger | The same moves, one task at a time, in wave order. A blocked TODO gets a comment with the reason and stays in `In Progress`. | per task |
| `revise` | spec `status: review` | Comment the drift on the `SPEC:` task, uncomplete it, and move it back to `Spec review`. | `Spec review` |
| `fix` | thought, then code | One new task with the label `bug` in `In Progress`, with a comment that links the TODO task it fixes. | `In Progress` |

When the last task is complete, run `td project archive "<spec name>"`.

## Rules

- A task MUST change section in the same step that changes the `status` key in `.notes/`. Two states that disagree is drift.
- An agent MUST only open the PR. Keep the merge yourself: in a repo where a merge is the deploy, an automatic merge is an automatic deploy.
- Refer to a task by `id:<id>` in every mutating command. Two TODO tasks can share words, and a name lookup can pick the wrong one.

## Amp Orb agent

A Todoist webhook can send a `Ready` task to an Amp Orb. The [todoist-amp-webhooks](../../todoist-amp-webhooks/SKILL.md) skill owns the setup.

- `.notes/` is a symlink to a jj repo under `~/.notes`, so it is not in git. A remote agent cannot read it. Before the task reaches the agent, paste the Outcome, the Acceptance, and the Files of the TODO into the task description.
