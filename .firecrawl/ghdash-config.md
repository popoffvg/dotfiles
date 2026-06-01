[Skip to content](https://www.gh-dash.dev/configuration/#_top)

# How to Configure

`dash` has extensive configuration options.

- Modify the default config which is usually under `$HOME/.config/gh-dash/config.yml`.
- Use the [`--config`](https://www.gh-dash.dev/getting-started/usage/#--config) flag to specify a different configuration file.
- Create a `.gh-dash.yml` file in a repo for project specific configuration.

Give me more details!
Using the following logic:

1. If `$GH_DASH_CONFIG` is a non-empty string, `dash` will use this file for
its configuration.
2. If `$GH_DASH_CONFIG` isn’t set and you’re in a git repository, it will look for `.gh-dash.yml` or `.gh-dash.yaml`
in the repository root.
3. If neither of the above applies, then:

- If `$XDG_CONFIG_HOME` is a non-empty string, the default path is `$XDG_CONFIG_HOME/gh-dash/config.yml`.
- If `$XDG_CONFIG_HOME` isn’t set, then:

  - On Linux and macOS systems, the default path is `$HOME/.config/gh-dash/config.yml`.
  - On Windows systems, the default path is `%USERPROFILE%\.config\gh-dash\config.yml`.

* * *

## Options

[Section titled “Options”](https://www.gh-dash.dev/configuration/#options)

The configuration for `dash` is schematized. The pages in this section list the configuration
options, their defaults, and how you can use them.

### Schema

[Section titled “Schema”](https://www.gh-dash.dev/configuration/#schema)

Documentation and schema for the configuration of your GitHub dashboard.

[Schema](https://www.gh-dash.dev/configuration/schema) Configure your IDE to autocomplete when editing the config file

[Defaults](https://www.gh-dash.dev/configuration/defaults) Documentation for the default setting options for your GitHub dashboard.

[Searching](https://www.gh-dash.dev/configuration/searching) How to search and filter issues and prs

[PR Section](https://www.gh-dash.dev/configuration/pr-section) Documentation for configuring the PR sections of your GitHub dashboard.

[Issue Section](https://www.gh-dash.dev/configuration/issue-section) Documentation for configuring the issue's sections of your GitHub dashboard.

[Keybindings](https://www.gh-dash.dev/configuration/keybindings) Documentation for defining commands for your GitHub dashboard.

[Layout](https://www.gh-dash.dev/configuration/layout/options) Documentation for configuring your GitHub dashboard’s layout.

[Theme](https://www.gh-dash.dev/configuration/theme) Documentation for configuring your GitHub dashboard’s theme.

[Reusing Settings](https://www.gh-dash.dev/configuration/reusing.mdx) Define global settings that will always be applied