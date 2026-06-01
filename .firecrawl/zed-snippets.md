Use the `snippets: configure snippets` action to create a new snippets file or edit an existing snippets file for a specified [scope](https://zed.dev/docs/snippets#scopes).

The snippets are located in `~/.config/zed/snippets` directory to which you can navigate to with the `snippets: open folder` action.

```json

{
  // Each snippet must have a name and body, but the prefix and description are optional.
  // The prefix is used to trigger the snippet, but when omitted then the name is used.
  // Use placeholders like $1, $2 or ${1:defaultValue} to define tab stops.
  // The $0 determines the final cursor position.
  // Placeholders with the same value are linked.
  // If the snippet contains the $ symbol outside of a placeholder, it must be escaped with two slashes (e.g. \\$var).
  "Log to console": {
    "prefix": "log",
    "body": ["console.info(\"Hello, ${1:World}!\")", "$0"],
    "description": "Logs to console"
  }
}
```

The scope is determined by the language name in lowercase e.g. `python.json` for Python, `shell script.json` for Shell Script, but there are some exceptions to this rule:

| Scope | Filename |
| --- | --- |
| Global | snippets.json |
| JSX | javascript.json |
| Plain Text | plaintext.json |

To create JSX snippets you have to use `javascript.json` snippets file, instead of `jsx.json`, but this does not apply to TSX and TypeScript which follow the above rule.

- Only the first prefix is used when a list of prefixes is passed in.
- Currently only the `json` snippet file format is supported.

[Code Completions](https://zed.dev/docs/completions.html "Code Completions") [Diagnostics & Quick Fixes](https://zed.dev/docs/diagnostics.html "Diagnostics & Quick Fixes")

Zed uses cookies to improve your experience and for marketing. Read [our cookie policy](https://zed.dev/cookie-policy) for more details.


Strictly Necessary

Analytics

Marketing

Reject all

Accept all