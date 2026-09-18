#!/bin/bash
# Block the AskUserQuestion tool — route the questions through the to-user skill instead.
reason='AskUserQuestion is forbidden. Load the `to-user` skill and write the questions into a file the operator edits in their own editor: one block per item with source link, original text, and a recommended answer. Then extract only their answers back.'
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s},"decision":"block","reason":%s}\n' \
  "$(printf '%s' "$reason" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
  "$(printf '%s' "$reason" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
