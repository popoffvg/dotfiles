[Skip to content](https://www.gh-dash.dev/configuration/theme#_top)

# Theme

# Theme Options

[Section titled “Theme Options”](https://www.gh-dash.dev/configuration/theme#theme-options)

This setting defines the dashboard’s theme. It only effects the presentation of the dashboard,
not the data. Currently, the theme only defines colors and icons. To control how table columns
and preview pane display for the views, use the [`defaults`](https://www.gh-dash.dev/configuration/defaults), [`prSections`](https://www.gh-dash.dev/configuration/pr-section), and
[`issueSections`](https://www.gh-dash.dev/configuration/issue-section) settings.

To define any color for your dashboard, you **must** define **every** color. All properties are
required properties. Every color for the dashboard’s theme must be a valid [hex color](https://developer.mozilla.org/en-US/docs/Web/CSS/hex-color) like
`#a3c` or `#aa33cc`, or an ANSI color index from `0` to `255`.

To find hex colors to use in your dashboard, visit [`color-hex.com`](https://www.color-hex.com/). You can browse colors,
inspect a given color, get alternate shades and tints for a color, derive a color palette, and
more.

## Defaults

[Section titled “Defaults”](https://www.gh-dash.dev/configuration/theme#defaults)

```
ui:

  sectionsShowCount: true

table:

  showSeparators: true

  compact: false

colors:

  text:

    primary: "#ffffff"

    secondary: "#c6c6c6"

    inverted: "#303030"

    faint: "#8a8a8a"

    warning: "#800000"

    success: "#008000"

    actor: "#c6c6c6"

  background:

    selected: "#808080"

  border:

    primary: "#808080"

    secondary: "#c0c0c0"

    faint: "#000000"

  inline:

    icons:

      newcontributor: "077"

      contributor: "075"

      collaborator: "178"

      member: "178"

      owner: "178"

      unknownrole: "178"

icons:

  inline:

    newcontributor: "󰎔"

    contributor: ""

    collaborator: ""

    member: ""

    owner: ""

    unknownrole: "󰭙"
```

## UI Settings (`ui`)

[Section titled “UI Settings (ui)”](https://www.gh-dash.dev/configuration/theme#ui-settings-ui)

### Sections Show Count

[Section titled “Sections Show Count”](https://www.gh-dash.dev/configuration/theme#sections-show-count)

| Property | Type | default |
| :-- | :-- | :-- |
| `sectionsShowCount` | boolean | true |

Whether the number of results show up next to each section’s title in the tab bar.

### Table Settings (`table`)

[Section titled “Table Settings (table)”](https://www.gh-dash.dev/configuration/theme#table-settings-table)

#### Show Separators

[Section titled “Show Separators”](https://www.gh-dash.dev/configuration/theme#show-separators)

| Property | Type | default |
| :-- | :-- | :-- |
| `showSeparators` | boolean | true |

Whether to show the separators between lines in the prs/issues tables.

#### Compact

[Section titled “Compact”](https://www.gh-dash.dev/configuration/theme#compact)

| Property | Type | default |
| :-- | :-- | :-- |
| `compact` | boolean | false |

Whether to show table rows in a compact way or not

## Theme Colors (`colors`)

[Section titled “Theme Colors (colors)”](https://www.gh-dash.dev/configuration/theme#theme-colors-colors)

This setting defines a map of colors for the dashboard’s text, background, and border
colors.

The following elements can’t be styled through your configuration and have their colors
set as:

| Element | Color |
| :-- | :-: |
| Search input terms when inactive | Terminal default (faint) |
| Search input terms when active | Terminal default |
| Inactive section names in the tab list | Terminal default |
| The status icon for open issues and PRs | `#42A0FA` |
| The status icon for closed issues | `#C38080` |
| The status icon for closed PRs | `#C38080` |
| The status icon for merged PRs | `#A371F7` |

Required:

- text
- background
- border

### Text Colors (`text`)

[Section titled “Text Colors (text)”](https://www.gh-dash.dev/configuration/theme#text-colors-text)

Defines the foreground (text) colors for the dashboard.

#### Primary Text Color

[Section titled “Primary Text Color”](https://www.gh-dash.dev/configuration/theme#primary-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `primary` | color | `#ffffff` for dark or `#000000` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- The active section’s name in the tab list
- The active view’s name
- The column headers for the section’s table of work items
- Open work item entries in the table except when a column’s icon has an alternate
color.
- The keybindings in the help view
- The title of the work item in the preview pane heading
- The comments and checks headers in the preview pane.
- The username for comment authors in the preview pane.

#### Secondary Text Color

[Section titled “Secondary Text Color”](https://www.gh-dash.dev/configuration/theme#secondary-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `secondary` | color | `#c6c6c6` for dark or `#808080` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- The search icon, `is:pr`, and `is:issue` components of the search bar
- The inactive view’s name
- The work item number in the table entries
- The work item number and repository name in the preview pane heading
- The base and target branch in the preview pane for PRs

#### Inverted Text Color

[Section titled “Inverted Text Color”](https://www.gh-dash.dev/configuration/theme#inverted-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `inverted` | color | `#303030` for dark or `#ffffff` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- The work item status in the preview pane
- Work item labels

#### Faint Text Color

[Section titled “Faint Text Color”](https://www.gh-dash.dev/configuration/theme#faint-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `faint` | color | `#8a8a8a` for dark or `#c0c0c0` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- Closed work item entries in the table
- The current time, active/total work item count, and fetched work item count
beneath the table
- The help text for the keybinding commands
- The percentage scrolled at the bottom of the preview pane
- The date/time information on comments in the preview pane
- The review status icon when a PR is waiting for a review

#### Warning Text Color

[Section titled “Warning Text Color”](https://www.gh-dash.dev/configuration/theme#warning-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `warning` | color | `#800000` for dark or `#800000` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- The icon for the `reviewStatus` column’s icon when a PR has requested changes
- The icon for the `ci` column’s icon when a PR has failing checks
- The icon for failing checks for PRs in the preview pane
- Error messages for commands, like when the dashboard fails to fetch work items.

#### Success Text Color

[Section titled “Success Text Color”](https://www.gh-dash.dev/configuration/theme#success-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `success` | color | `#008000` for dark or `008000` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- The icon for the `reviewStatus` column’s icon when a PR is approved
- The icon for the `ci` column’s icon when a PR’s checks are all passing
- The icon for passing checks for PRs in the preview pane
- Success messages for commands, like when the dashboard fetches work items.

#### Actor Text Color

[Section titled “Actor Text Color”](https://www.gh-dash.dev/configuration/theme#actor-text-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `actor` | color | `#c6c6c6` for dark or `#808080` for light |

This setting determines the color of the text for the following elements in the
dashboard UI:

- The username of the person who triggered a notification, displayed after the
notification title in the notifications view

### Background Colors (`background`)

[Section titled “Background Colors (background)”](https://www.gh-dash.dev/configuration/theme#background-colors-background)

Defines the background colors for the dashboard. By default, the background color for
all elements in the dashboard UI is the terminal’s background color.

Required:

- selected

#### Selected Background Color

[Section titled “Selected Background Color”](https://www.gh-dash.dev/configuration/theme#selected-background-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `selected` | color | `#808080` for dark or `#c0c0c0` for light |

This setting determines the background color for the following elements in the
dashboard UI:

- The active section’s name in the tab list
- The active view’s name
- The active entry in the section’s work item table.

### Border Colors (`border`)

[Section titled “Border Colors (border)”](https://www.gh-dash.dev/configuration/theme#border-colors-border)

| Property | Type | default |
| :-- | :-- | :-- |
| `border` | color | `#808080` for dark or `#c0c0c0` for light |

Defines the border colors for the dashboard.

Required:

- primary
- secondary
- faint

#### Primary Border Color

[Section titled “Primary Border Color”](https://www.gh-dash.dev/configuration/theme#primary-border-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `primary` | color | `#808080` for dark or `#ff00ff` for light |

This setting determines the color for the following elements in the dashboard UI:

- The border beneath the section tabs
- The border around the search input
- The border between the table and the preview pane
- The border above the command help info

#### Secondary Border Color

[Section titled “Secondary Border Color”](https://www.gh-dash.dev/configuration/theme#secondary-border-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `secondary` | color | `#c0c0c0` for dark or `#808080` for light |

This setting determines the color for the following elements in the dashboard UI:

- The borders that separate the sections in the tab list

#### Faint Border Color

[Section titled “Faint Border Color”](https://www.gh-dash.dev/configuration/theme#faint-border-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `faint` | color | `#000000` for dark or `#e4e4e4` for light |

This setting determines the color for the following elements in the dashboard UI:

- The border between rows in the table

### Icon Colors (`inline.icons`)

[Section titled “Icon Colors (inline.icons)”](https://www.gh-dash.dev/configuration/theme#icon-colors-inlineicons)

Defines author-role icon colors for the dashboard.

#### New Contributor Role Icon Color

[Section titled “New Contributor Role Icon Color”](https://www.gh-dash.dev/configuration/theme#new-contributor-role-icon-color)

`newcontributor`

| Property | Type | default |
| :-- | :-- | :-- |
| `newcontributor` | color |  |

Specifies the icon color for the new-contributor-role icon.

#### Contributor Role Icon Color

[Section titled “Contributor Role Icon Color”](https://www.gh-dash.dev/configuration/theme#contributor-role-icon-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `contributor` | color |  |

Specifies the icon color for the contributor-role icon.

#### Collaborator Role Icon Color

[Section titled “Collaborator Role Icon Color”](https://www.gh-dash.dev/configuration/theme#collaborator-role-icon-color)

collaborator:

| Property | Type | default |
| :-- | :-- | :-- |
| `collaborator` | color |  |

Specifies the icon color for the collaborator-role icon.

#### Member Role Icon Color

[Section titled “Member Role Icon Color”](https://www.gh-dash.dev/configuration/theme#member-role-icon-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `member` | color |  |

Specifies the icon color for the member-role icon.

#### Owner Role Icon Color

[Section titled “Owner Role Icon Color”](https://www.gh-dash.dev/configuration/theme#owner-role-icon-color)

Specifies the icon color for the owner-role icon.

#### Unknown Role Icon Color

[Section titled “Unknown Role Icon Color”](https://www.gh-dash.dev/configuration/theme#unknown-role-icon-color)

| Property | Type | default |
| :-- | :-- | :-- |
| `unknown` | color |  |

Specifies the icon color for the unknown-role icon.

## Icons (`icons.inline`)

[Section titled “Icons (icons.inline)”](https://www.gh-dash.dev/configuration/theme#icons-iconsinline)

This setting defines a map of author-role icons for the dashboard.

### New Contributor Role Icon

[Section titled “New Contributor Role Icon”](https://www.gh-dash.dev/configuration/theme#new-contributor-role-icon)

Specifies the character to use as the new-contributor-role icon.

| Property | Type | default |
| :-- | :-- | :-- |
| `newcontributor` | string | 󰎔 |

### Contributor Role Icon Color

[Section titled “Contributor Role Icon Color”](https://www.gh-dash.dev/configuration/theme#contributor-role-icon-color-1)

Specifies the character to use as the contributor-role icon.

| Property | Type | default |
| :-- | :-- | :-- |
| `contributor` | string |  |

### Collaborator Role Icon Color

[Section titled “Collaborator Role Icon Color”](https://www.gh-dash.dev/configuration/theme#collaborator-role-icon-color-1)

Specifies the character to use as the collaborator-role icon.

| Property | Type | default |
| :-- | :-- | :-- |
| `collaborator` | string |  |

### Member Role Icon Color

[Section titled “Member Role Icon Color”](https://www.gh-dash.dev/configuration/theme#member-role-icon-color-1)

Specifies the character to use as the member-role icon.

| Property | Type | default |
| :-- | :-- | :-- |
| `member` | string |  |

### Owner Role Icon Color

[Section titled “Owner Role Icon Color”](https://www.gh-dash.dev/configuration/theme#owner-role-icon-color-1)

Specifies the character to use as the owner-role icon.

| Property | Type | default |
| :-- | :-- | :-- |
| `owner` | string |  |

### Unknown Role Icon Color

[Section titled “Unknown Role Icon Color”](https://www.gh-dash.dev/configuration/theme#unknown-role-icon-color-1)

Specifies the character to use as the unknown-role icon.

| Property | Type | default |
| :-- | :-- | :-- |
| `unknownrole` | string | 󰭙 |