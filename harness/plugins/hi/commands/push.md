---
description: Push a prompt onto the per-session store
allowed-tools: Bash(bash:*)
disable-model-invocation: true
---
!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/store.sh" push "$ARGUMENTS"`
