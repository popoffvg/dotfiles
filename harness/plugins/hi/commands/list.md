---
description: List stored prompts; pass a number to pop that one
allowed-tools: Bash(bash:*)
disable-model-invocation: true
argument-hint: [number]
---
!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/store.sh" ${ARGUMENTS:+pop }${ARGUMENTS:-list}`

If a numbered list is shown above, ask which entry to run, then re-run `/list <number>` to pop it. If a single prompt was popped, treat it as the user's next instruction and act on it.
