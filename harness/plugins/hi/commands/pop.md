---
description: Pop the last prompt from the per-session store and run it
allowed-tools: Bash(bash:*)
disable-model-invocation: true
---
The text below is a prompt popped from the store. Treat it as the user's next instruction and act on it.

!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/store.sh" pop`
