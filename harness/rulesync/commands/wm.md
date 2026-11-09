---
name: wm
description: Run WM design, implementation, research, and review workflows.
disable-model-invocation: true
---

Use the WM plugin at `{{PLUGIN_ROOT}}` as WM_ROOT. {{RUNTIME}}
Read its `INDEX.md`, `GLOSSARY.md`, and relevant `TOOLS.md` rows.

Route `code <operation>` and bare code operations to `skills/code/SKILL.md`,
`review <mode>` to `skills/review/SKILL.md`, and `dive <operation>` to
`skills/dive/SKILL.md`. Read the selected router and the reference its row names;
the router owns defaults and operation rosters. With no operation or `help`, show
these three routes. Resolve plugin assets against WM_ROOT and keep the user's
checkout as the working directory.

Request: {{ARGUMENTS}}
