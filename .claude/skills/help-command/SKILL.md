---
name: help-command
description: Use when writing or fixing a `*-help` slash command in a plugin under harness/plugins/ — a command whose only job is to print a static help table/guide. Trigger on "add a help command", "write a help command", "the help command prints junk / shows load summary instead of the table", "fix code-help/work-help".
---

# Writing a `*-help` command

A help command is a Claude Code slash command whose body is **static reference content** (a command table, a usage guide). Its only job: print that content verbatim. It must not reason, summarize, or call tools.

## Where it lives

`harness/plugins/<plugin>/commands/<name>-help.md`. The plugin dir is the plugin root; `commands/*.md` auto-register as `/<plugin>:<name>-help`.

## Structure

```markdown
---
name: <name>-help
description: Show all /<thing> subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/<thing> <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `foo` *(default)* | … |
| `bar` | … |
```

## The one rule that matters

Open the body with an explicit verbatim directive:

> `Print the following <table|guide> verbatim. No preamble, no commentary, no tool calls — output only the markdown below.`

A slash-command file is injected as a prompt, then the model responds. A soft lead-in like `Display this table:` lets the model paraphrase, add chatter, or fire tool calls instead of printing the content. The directive above pins it to emit the block and nothing else.

## Checklist

- Frontmatter `name:` matches the filename (`code-help` → `code-help.md`).
- Body = verbatim directive, then the static content. No logic, no `${CLAUDE_PLUGIN_ROOT}` references, no tool use.
- Keep every help command in the plugin consistent — same directive wording.
- Editing files under `harness/plugins/<plugin>/` trips the pre-commit hook → that plugin's `plugin.json` minor-bumps on commit. Expected.
- Reload to test: `/reload-plugins`, then run `/<plugin>:<name>-help`.
