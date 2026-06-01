[Skip to content](https://www.gh-dash.dev/configuration/keybindings/#_top)

# Custom Keybindings

`dash` allows you to override existing keybindings as well as add custom ones.

Every valid entry for the configuration options must have a `key` and `command`.
When a user presses the key or key combination the dashboard shells out and executes the command.

To help you identify your custom commands, an additional `name` property can be supplied to describe it in the help menu.

There are 3 types of keybindings: `universal`, `prs` and `issues`.

## Universal Keybindings

[Section titled “Universal Keybindings”](https://www.gh-dash.dev/configuration/keybindings/#universal-keybindings)

Define keybindings that will work in any view.

For example:

```
keybindings:

  universal:

    - key: g

      name: lazygit

      command: >

        cd {{.RepoPath}} && lazygit

    - key: s

      builtin: search
```

### Built-in Commands

[Section titled “Built-in Commands”](https://www.gh-dash.dev/configuration/keybindings/#built-in-commands)

The following built-in universal commands can be overridden with custom keybinds:

| Command | Description |
| --- | --- |
| `up` | row up |
| `down` | row down |
| `firstLine` | go to first row |
| `lastLine` | go to last row |
| `togglePreview` | toggle the preview pane |
| `openGithub` | open the selection in GitHub |
| `refresh` | refresh the current section |
| `refreshAll` | refresh all sections |
| `redraw` | redraw the screen - in case of visual artifacts |
| `pageDown` | go one page down in the preview pane |
| `pageUp` | go one page up in the preview pane |
| `nextSection` | go to next section |
| `prevSection` | go to previous section |
| `search` | focus the search bar |
| `copyurl` | copy the URL of the selected row |
| `copyNumber` | copy the number of the selected row |
| `help` | toggle the help menu |
| `quit` | quit gh-dash |

See [global keys](https://www.gh-dash.dev/getting-started/keybindings/global/) and [navigation keys](https://www.gh-dash.dev/getting-started/keybindings/navigation/) for more details.

## PR Keybindings

[Section titled “PR Keybindings”](https://www.gh-dash.dev/configuration/keybindings/#pr-keybindings)

Define any number of keybindings for the PRs view or override existing ones.

For example:

```
keybindings:

  prs:

    - key: O

      builtin: checkout

    - key: m

      command: gh pr merge --admin --repo {{.RepoName}} {{.PrNumber}}

    - key: g

      name: lazygit add

      command: >

        cd {{.RepoPath}} && git add -A && lazygit

    - key: v

      name: approve

      command: >

        gh pr review --repo {{.RepoName}} --approve --body "$(gum input --prompt='Approval Comment: ')" {{.PrNumber}}
```

### Available Command Arguments

[Section titled “Available Command Arguments”](https://www.gh-dash.dev/configuration/keybindings/#available-command-arguments)

| Argument | Description |
| --- | --- |
| `RepoName` | The full name of the repo (e.g. `dlvhdr/gh-dash`) |
| `RepoPath` | The path to the Repo, using the `config.yml``repoPaths` key to get the mapping |
| `PrNumber` | The PR number |
| `HeadRefName` | The PR’s head branch name |
| `BaseRefName` | The PR’s base branch name |
| `Author` | The username of the PR author |

### Built-in Commands

[Section titled “Built-in Commands”](https://www.gh-dash.dev/configuration/keybindings/#built-in-commands-1)

The following built-in PR commands can be overridden with custom keybinds:

| Command | Description |
| --- | --- |
| `prevSidebarTab` | previous sidebar tab |
| `nextSidebarTab` | next sidebar tab |
| `approve` | approve the PR |
| `assign` | assign users to the PR |
| `unassign` | unassign users from the PR |
| `comment` | add a comment to the PR |
| `diff` | show the diff of the PR |
| `checkout` | locally checkout the PR |
| `close` | close the PR |
| `ready` | mark the PR as ready |
| `reopen` | reopen a closed PR |
| `merge` | merge the PR |
| `update` | update the PR to the latest base branch |
| `watchChecks` | watch the checks of the PR and get notified |
| `approveWorkflows` | approve the runs of the PR |
| `viewIssues` | switch to the Issues view |
| `summaryViewMore` | expand the truncated PR description |

See [PR keys](https://www.gh-dash.dev/getting-started/keybindings/selected-pr/) for more details.

## Issue Keybindings

[Section titled “Issue Keybindings”](https://www.gh-dash.dev/configuration/keybindings/#issue-keybindings)

Define any number of keybindings for the issues view or override existing ones.

For example:

```
keybindings:

  issues:

    key: "P"

    command: >

      gh issue pin {{ .IssueNumber }} --repo {{ .RepoName }}
```

### Available Command Arguments

[Section titled “Available Command Arguments”](https://www.gh-dash.dev/configuration/keybindings/#available-command-arguments-1)

| Argument | Description |
| --- | --- |
| `RepoName` | The full name of the repo (e.g. `dlvhdr/gh-dash`) |
| `RepoPath` | The path to the Repo, using the `config.yml``repoPaths` key to get the mapping |
| `IssueNumber` | The issue number |
| `IssueTitle` | The issue title |
| `Author` | The username of the issue author |

### Built-in Commands

[Section titled “Built-in Commands”](https://www.gh-dash.dev/configuration/keybindings/#built-in-commands-2)

The following built-in PR commands can be overridden with custom keybinds:

| Command | Description |
| --- | --- |
| `label` | edit the issue’s labels |
| `assign` | assign users to the issue |
| `unassign` | remove assigned users from the issue |
| `comment` | add a comment to the issue |
| `checkout` | checkout a branch for the issue |
| `close` | close the issue |
| `reopen` | reopen a closed issue |
| `viewPrs` | switch to the PRs view |

See [issue keys](https://www.gh-dash.dev/getting-started/keybindings/selected-issue/) for more details.

## Notification Keybindings

[Section titled “Notification Keybindings”](https://www.gh-dash.dev/configuration/keybindings/#notification-keybindings)

Define any number of keybindings for the notifications view or override existing ones.

For example:

```
keybindings:

  notifications:

    - key: d

      builtin: markAsDone

    - key: D

      builtin: markAllAsDone
```

### Available Command Arguments

[Section titled “Available Command Arguments”](https://www.gh-dash.dev/configuration/keybindings/#available-command-arguments-2)

The command template receives different fields depending on whether the sidebar has been opened:

| State | PR template fields |
| --- | --- |
| Sidebar not open | `RepoName`, `PrNumber`, `RepoPath` |
| Sidebar open | \+ `HeadRefName`, `BaseRefName`, `Author` |

| State | Issue template fields |
| --- | --- |
| Sidebar not open | `RepoName`, `IssueNumber`, `RepoPath` |
| Sidebar open | \+ `Author` |

If a template references a sidebar-only field (e.g., `{{.HeadRefName}}`) before the sidebar is opened, the template engine’s `missingkey=error` option produces an error message. This is intentional — users should open the notification first to populate the full data.

### Built-in Commands

[Section titled “Built-in Commands”](https://www.gh-dash.dev/configuration/keybindings/#built-in-commands-3)

The following built-in notifications commands can be overridden with custom keybinds:

| Command | Description |
| --- | --- |
| `view` | view notification (fetches content, marks as read) |
| `markAsDone` | mark as done (removes from inbox) |
| `markAllAsDone` | mark all as done |
| `markAsRead` | mark as read |
| `markAllAsRead` | mark all as read |
| `unsubscribe` | unsubscribe from thread |
| `toggleBookmark` | toggle bookmark |

See [notification keys](https://www.gh-dash.dev/getting-started/keybindings/selected-notification/) for more details.