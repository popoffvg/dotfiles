#!/usr/bin/env bash
# PostToolUse hook for Bash.
# Detects when Claude used bash as a workaround for dedicated tools
# (Read / Edit / Write / Grep / Glob) and injects a non-blocking
# "heads up" reminder into the next turn's context.
#
# Rationale: models routinely reach for the Turing-complete shell to
# satisfy tasks that already have a safer, structured tool. This is a
# common agent-design footgun. We don't block — we nudge.

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$CMD" ]; then
  exit 0
fi

# Strip leading `rtk ` wrapper if present (rtk-rewrite hook prepends it).
STRIPPED="${CMD#rtk }"

reasons=()

# --- in-place edits ---------------------------------------------------------
if [[ "$STRIPPED" =~ (^|[[:space:];&|])sed[[:space:]]+[^|]*-i([[:space:]]|$) ]]; then
  reasons+=("\`sed -i\` edits files in place — use the **Edit** tool instead.")
fi
if [[ "$STRIPPED" =~ (^|[[:space:];&|])awk[[:space:]]+[^|]*-i[[:space:]]+inplace ]]; then
  reasons+=("\`awk -i inplace\` edits files in place — use the **Edit** tool instead.")
fi
if [[ "$STRIPPED" =~ (^|[[:space:];&|])perl[[:space:]]+[^|]*-i([[:space:]]|$) ]]; then
  reasons+=("\`perl -i\` edits files in place — use the **Edit** tool instead.")
fi

# --- writing whole files via redirect ---------------------------------------
# echo/printf with > or >> to a file path (not /dev/*)
re_write='(^|[[:space:];&|])(echo|printf)[[:space:]][^|]*>[[:space:]]*[^[:space:]&|]+'
if [[ "$STRIPPED" =~ $re_write ]]; then
  match="${BASH_REMATCH[0]}"
  if [[ ! "$match" =~ /dev/(null|stderr|stdout|tty) ]]; then
    reasons+=("Writing file content via \`echo/printf > file\` — use the **Write** tool (or **Edit** for partial changes).")
  fi
fi
re_heredoc='cat[[:space:]]*<<-?[\"'"'"']?[A-Za-z_]+'
re_redir='>[[:space:]]*[^[:space:]&|]+'
if [[ "$STRIPPED" =~ $re_heredoc ]] && [[ "$STRIPPED" =~ $re_redir ]]; then
  reasons+=("Heredoc (\`cat <<EOF > file\`) — use the **Write** tool instead.")
fi

# --- reading whole files (only when bash is the sole consumer) --------------
if [[ "$STRIPPED" != *"|"* ]] && [[ "$STRIPPED" != *">"* ]]; then
  re_cat='^[[:space:]]*cat[[:space:]]+[^-][^[:space:]]*'
  if [[ "$STRIPPED" =~ $re_cat ]]; then
    reasons+=("\`cat <file>\` to inspect contents — use the **Read** tool.")
  fi
  re_headtail='^[[:space:]]*(head|tail)[[:space:]]+(-n[[:space:]]*[0-9]+[[:space:]]+)?[^-][^[:space:]]*[[:space:]]*$'
  if [[ "$STRIPPED" =~ $re_headtail ]]; then
    reasons+=("\`head/tail <file>\` — use the **Read** tool with \`offset\`/\`limit\`.")
  fi
fi

# --- grep / find on tracked code (CLAUDE.md prefers fff) --------------------
re_grep_r='^[[:space:]]*grep[[:space:]]+[^|]*-[rR]'
if [[ "$STRIPPED" =~ $re_grep_r ]]; then
  reasons+=("Recursive \`grep -r\` over the repo — prefer **mcp__fff__grep** (or **Grep** tool) for indexed search.")
fi
re_find='^[[:space:]]*find[[:space:]]+\.[[:space:]]+-name'
if [[ "$STRIPPED" =~ $re_find ]]; then
  reasons+=("\`find . -name\` — prefer **mcp__fff__find_files** (or **Glob**) for indexed file lookup.")
fi

if [ ${#reasons[@]} -eq 0 ]; then
  exit 0
fi

# Build the heads-up message.
header="⚠️ Bash bypass detected — you used the shell where a dedicated tool exists."
body=""
for r in "${reasons[@]}"; do
  body+=$'\n- '"$r"
done
footer=$'\n\nNext time, prefer the dedicated tool: it is safer, cheaper, and the user audits these patterns.'

MSG="${header}${body}${footer}"

jq -n --arg msg "$MSG" '{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $msg
  }
}'
