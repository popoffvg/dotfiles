---
description: Clear the per-session prompt store
allowed-tools: Bash(bash:*)
disable-model-invocation: true
---
!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/store.sh" drop`
