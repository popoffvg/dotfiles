---
name: line-comment-distill
description: Distill saved line-comment patterns into global review rules after approval.
disable-model-invocation: true
---

Read `{{LINE_COMMENT_ROOT}}/internal-commands/distill.md` and follow it.
Resolve plugin-root variables against `{{LINE_COMMENT_ROOT}}` and sibling
command references against its `internal-commands/` directory. Use the request
below for the command's argument placeholder. Translate Claude tool names to available host
tools, and load named internal skills through the harness skill index. Preserve
the command's approval gates and subagent instructions; report unavailable
capabilities instead of claiming they ran.

Request: {{ARGUMENTS}}
