#!/usr/bin/env bash
# PreToolUse hook (self-improvement plugin): auto-approve the file edits the
# capture-lesson skill needs, so the permission ships WITH the plugin
# instead of living in the user's global settings.json (plugins can't declare
# permissions; a PreToolUse "allow" decision is the only plugin-scoped path).
#
# Approves Read/Edit/Write on:
#   ~/.claude/skills/**      global skills the skill authors
#   **/.claude/skills/**     project skills the skill authors
# Anything else: exit 0 with no output -> defer to normal permission flow.
set -euo pipefail

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')
case "$tool" in
  Read|Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
[ -n "$path" ] || exit 0

case "$path" in
  "$HOME"/.claude/skills/*|*/.claude/skills/*|.claude/skills/*)
    jq -nc '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"self-improvement: managed skill edit"}}'
    ;;
  *)
    exit 0
    ;;
esac
