[Skip to content](https://www.gh-dash.dev/configuration/defaults#_top)

# Defaults

## Default Options (`defaults`)

[Section titled “Default Options (defaults)”](https://www.gh-dash.dev/configuration/defaults#default-options-defaults)

These settings define the default behavior for the dashboard. You can override many of these
settings on a per-section basis.

```
defaults:

  issuesLimit: 20

  notificationsLimit: 20

  prApproveComment: LGTM

  preview:

    open: true

    width: 0.45

    height: 0.60

    position: auto

  prsLimit: 20

  refetchIntervalMinutes: 30

  view: prs
```

By default, the dashboard is configured to:

- Display the preview pane to the right at 45% width, or below at 40% height when the terminal is narrow.
- Only fetch 20 PRs, issues, and notifications at a time for each section.
- Display the PRs view when the dashboard loads.
- Refetch PRs and issues for each section every 30 minutes.
- Display dates using relative values.

For more details on the default layouts, see the documentation for [PR](https://www.gh-dash.dev/configuration/layout/pr/) and [issue](https://www.gh-dash.dev/configuration/layout/issue/) layout definitions.

### Layout Options (`layout`)

[Section titled “Layout Options (layout)”](https://www.gh-dash.dev/configuration/defaults#layout-options-layout)

This setting defines the layout for the work item tables in the dashboard. You can override
these settings in any section you define in the [`prSections`](https://www.gh-dash.dev/configuration/pr-section) or [`issueSections`](https://www.gh-dash.dev/configuration/issue-section) settings.

They determine which columns are displayed and how.

#### PR Section Layout

[Section titled “PR Section Layout”](https://www.gh-dash.dev/configuration/defaults#pr-section-layout)

You can define how a PR section displays items in its table by setting options for the
available columns. You can define a column’s width, whether it grows to fill available space,
and whether the column should be visible at all.

Note that if the length of a column’s text exceeds the defined column [`width`](https://www.gh-dash.dev/configuration/layout/options), the view
truncates the column’s text to two characters shorter than the column’s width. For example, if
the width is `6`, `gh-dash` displays as `gh-d`.

Column headings have their color defined by the [`theme.colors.text.primary`](https://www.gh-dash.dev/configuration/theme) setting.

For more information, see [PR Section Layout](https://www.gh-dash.dev/configuration/layout/pr).

#### Issue Section Layout (`issues`)

[Section titled “Issue Section Layout (issues)”](https://www.gh-dash.dev/configuration/defaults#issue-section-layout-issues)

You can define how an issue section displays items in its table by setting options for the
available columns. You can define a column’s width, whether it grows to fill available space,
and whether the column should be visible at all.

Note that if the length of a column’s text exceeds the defined column [`width`](https://www.gh-dash.dev/configuration/layout/options), the view
truncates the column’s text to two characters shorter than the column’s width. For example, if
the width is `6`, `gh-dash` displays as `gh-d`.

Column headings have their color defined by the [`theme.colors.text.primary`](https://www.gh-dash.dev/configuration/theme) setting.

For more information, see [Issue Section Layout](https://www.gh-dash.dev/configuration/layout/issue).

### PR Fetch Limit

[Section titled “PR Fetch Limit”](https://www.gh-dash.dev/configuration/defaults#pr-fetch-limit)

| Type | Minimum | Default |
| :-- | :-: | :-: |
| Integer | 1 | 20 |

This setting defines how many PRs the dashboard should fetch for each section when:

- The dashboard first loads.
- The [fetch interval](https://www.gh-dash.dev/configuration/defaults#refetch-interval-in-minutes-refetchintervalminutes) elapses.
- You navigate to the next PR in a table without another fetched PR to display.
- You use the [refresh current section](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-current-section) or [refresh all sections](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-all-sections) commands.

### Issue Fetch Limit (`issuesLimit`)

[Section titled “Issue Fetch Limit (issuesLimit)”](https://www.gh-dash.dev/configuration/defaults#issue-fetch-limit-issueslimit)

| Type | Minimum | Default |
| :-- | :-: | :-: |
| Integer | 1 | 20 |

This setting defines how many issues the dashboard should fetch for each section when:

- The dashboard first loads.
- The [fetch interval](https://www.gh-dash.dev/configuration/defaults#refetch-interval-in-minutes-refetchintervalminutes) elapses.
- You navigate to the next issue in a table without another fetched issue to display.
- You use the [refresh current section](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-current-section) or [refresh all sections](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-all-sections) commands.

### Notifications Fetch Limit (`notificationsLimit`)

[Section titled “Notifications Fetch Limit (notificationsLimit)”](https://www.gh-dash.dev/configuration/defaults#notifications-fetch-limit-notificationslimit)

| Type | Minimum | Default |
| :-- | :-: | :-: |
| Integer | 1 | 20 |

This setting defines how many notifications the dashboard should fetch when:

- The dashboard first loads.
- You navigate to the next notification in a table without another fetched notification to display.
- You use the [refresh current section](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-current-section) or [refresh all sections](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-all-sections) commands.

### Preview Pane (`preview`)

[Section titled “Preview Pane (preview)”](https://www.gh-dash.dev/configuration/defaults#preview-pane-preview)

These settings define how the preview pane displays in the dashboard. You can specify
whether the preview pane is open by default, its width (for right position), its height
(for bottom position), and its position relative to the main content.

#### Open on Load (`open`)

[Section titled “Open on Load (open)”](https://www.gh-dash.dev/configuration/defaults#open-on-load-open)

| Type | Default |
| :-- | :-: |
| Boolean | true |

Specifies whether the preview pane should be open by default for the selected work item
when the dashboard loads. You can always use the [toggle preview pane](https://www.gh-dash.dev/getting-started/keybindings/preview/#p---toggle-preview-pane) command to
toggle the preview pane’s visibility.

By default, the dashboard displays the preview pane.

#### Preview Pane Width (`width`)

[Section titled “Preview Pane Width (width)”](https://www.gh-dash.dev/configuration/defaults#preview-pane-width-width)

| Type | Minimum | Default |
| :-- | :-: | :-: |
| Number | 0 | 0.45 |

Specifies the width of the preview pane. You can set the size to the percentage of the terminal size by using fractions (e.g. 0.4 would be 40%).

By default, the preview pane is 45% wide.

#### Preview Pane Height (`height`)

[Section titled “Preview Pane Height (height)”](https://www.gh-dash.dev/configuration/defaults#preview-pane-height-height)

| Type | Minimum | Default |
| :-- | :-: | :-: |
| Number | 0 | 0.60 |

Specifies the height of the preview pane when it appears below the main content (in bottom
position mode). You can set the size to a percentage of the terminal height by using
fractions (e.g. 0.4 would be 40%). Values greater than 1 specify a fixed number of rows.

By default, the preview pane height is 40%.

#### Preview Pane Position (`position`)

[Section titled “Preview Pane Position (position)”](https://www.gh-dash.dev/configuration/defaults#preview-pane-position-position)

| Type | Options | Default |
| :-- | :-: | :-: |
| String | `right`, `bottom`, `auto` | `auto` |

Specifies where the preview pane appears relative to the main content.

- `right` — the preview pane appears to the right of the main content (vertical split).
- `bottom` — the preview pane appears below the main content (horizontal split).
- `auto` — automatically chooses `right` when the terminal is wide enough, and switches
to `bottom` when the main content would have fewer than 80 columns.

You can toggle the position at runtime with the `P` key.

By default, the position is `auto`.

### Refetch Interval in Minutes (`refetchIntervalMinutes`)

[Section titled “Refetch Interval in Minutes (refetchIntervalMinutes)”](https://www.gh-dash.dev/configuration/defaults#refetch-interval-in-minutes-refetchintervalminutes)

| Type | Minimum | Default |
| :-- | :-: | :-: |
| Integer | 0 | 30 |

This setting defines how often the dashboard should fetch issues and PRs from GitHub. The
dashboard fetches work items for every section in the active view when the dashboard loads
and the first time you switch to the inactive view.

After the dashboard fetches the work items for the first time, it waits until this setting’s
defined interval elapses before fetching the work items again.

By default, the dashboard refetches work items every 30 minutes.

To disable the refetching interval set it to 0.

You can always use the [refresh current section](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-current-section) or [refresh all sections](https://www.gh-dash.dev/getting-started/keybindings/global/#r---refresh-all-sections) command to
refetch work items in the current view. If you change the search query for a view, the
dashboard fetches results for the updated query immediately.

### Date format (`dateFormat`)

[Section titled “Date format (dateFormat)”](https://www.gh-dash.dev/configuration/defaults#date-format-dateformat)

| Type | Default |
| :-- | :-: |
| String | ”relative” |

This setting defines how dates are formatted. The format either be “relative” or a [go time format](https://pkg.go.dev/time#pkg-constants).

By default, the format is “relative” which fits just inside the default column width of
updated at in the issues and pull request layouts.

You may need to adjust the layout column width depending on your format.

### Default View (`view`)

[Section titled “Default View (view)”](https://www.gh-dash.dev/configuration/defaults#default-view-view)

| Type | Options | Default |
| :-- | :-: | :-: |
| String | ”notifications”, “prs”, “issues" | "prs” |

This setting defines whether the dashboard should display the Notifications, PRs, or Issues
view when it first loads.

By default, the dashboard displays the PRs view.

### PR Approval (`prApproveComment`)

[Section titled “PR Approval (prApproveComment)”](https://www.gh-dash.dev/configuration/defaults#pr-approval-prapprovecomment)

| Type | Default |
| :-- | :-: |
| String | ”LGTM” |

This setting defines the default comment used as a starting point when [approving a PR](https://www.gh-dash.dev/getting-started/keybindings/selected-pr/#v---approve-pr).
This can be set as an empty string to not prefill a comment.

By default, the comment is “LGTM”.

## Confirm Quit (`confirmQuit`)

[Section titled “Confirm Quit (confirmQuit)”](https://www.gh-dash.dev/configuration/defaults#confirm-quit-confirmquit)

| Type | Default |
| :-- | :-: |
| Boolean | false |

This setting specifies whether the user needs to confirm when quitting `gh-dash`
When this is on, `gh-dash` shows a prompt that requires the user to press `y`/ `Enter` to actually quit.
Pressing any other key dismisses the message.

By default, dash doesn’t need a confirmation.

## Include Read Notifications (`includeReadNotifications`)

[Section titled “Include Read Notifications (includeReadNotifications)”](https://www.gh-dash.dev/configuration/defaults#include-read-notifications-includereadnotifications)

| Type | Default |
| :-- | :-: |
| Boolean | true |

This setting controls whether the default notification view includes read notifications
alongside unread ones, matching GitHub’s default behavior.

When set to `true` (the default), notification sections with no explicit `is:` filter show
both read and unread notifications. When set to `false`, they show only unread notifications
plus any bookmarked items.

Explicit filters like `is:unread` or `is:read` in a section’s `filters` always override
this setting.

```
# Show only unread notifications by default (old behavior)

includeReadNotifications: false
```