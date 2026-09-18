#!/usr/bin/env bash
# Scan recent Claude Code transcripts: MCP tool calls, skill dispatches, slash commands, hook timings, denials.
set -uo pipefail
N="${1:-50}"
OUT="${2:-/tmp/doctor-scan}"
mkdir -p "$OUT"
FILES=$(find "$HOME/.claude/projects" -name '*.jsonl' -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -n "$N")
[ -z "$FILES" ] && { echo "no transcripts"; exit 0; }
echo "$FILES" > "$OUT/files.txt"
echo "=== WINDOW ==="
echo "$FILES" | wc -l | tr -d ' ' | sed 's/^/sessions: /'
echo "$FILES" | head -1 | xargs stat -f '%Sm' -t '%Y-%m-%d' | sed 's/^/newest: /'
echo "$FILES" | tail -1 | xargs stat -f '%Sm' -t '%Y-%m-%d' | sed 's/^/oldest: /'
echo "$FILES" | xargs -I{} dirname {} | sort -u | wc -l | tr -d ' ' | sed 's/^/projects: /'

echo "=== MCP TOOL CALLS ==="
echo "$FILES" | xargs cat 2>/dev/null | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name | select(startswith("mcp__"))' 2>/dev/null | sed 's/^mcp__//; s/__.*//' | sort | uniq -c | sort -rn

echo "=== SKILL DISPATCHES ==="
echo "$FILES" | xargs cat 2>/dev/null | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use" and .name=="Skill") | .input.skill // empty' 2>/dev/null | sort | uniq -c | sort -rn

echo "=== SLASH COMMANDS ==="
echo "$FILES" | xargs cat 2>/dev/null | grep -o '<command-name>[^<]*</command-name>' 2>/dev/null | sed 's|.*<command-name>||; s|</command-name>||' | sort | uniq -c | sort -rn | head -40

echo "=== HOOK TIMINGS (name|event count avg max) ==="
echo "$FILES" | xargs cat 2>/dev/null | jq -r 'select(.type=="attachment") | .attachment | select(.type != null and (.type|startswith("hook_"))) | [(.hookName//"?"), (.hookEvent//"?"), (.durationMs//0|tostring), (.type), ((.timedOut//false)|tostring)] | @tsv' 2>/dev/null > "$OUT/hooks.tsv"
awk -F'\t' '{k=$1"|"$2; c[k]++; s[k]+=$3; if($3>m[k])m[k]=$3; if($5=="true")t[k]++} END{for(k in c) printf "%s\tcount=%d\tavg=%d\tmax=%d\ttimedout=%d\n",k,c[k],s[k]/c[k],m[k],t[k]+0}' "$OUT/hooks.tsv" | sort -t= -k3 -rn

echo "=== DENIALS (kind) ==="
echo "$FILES" | xargs cat 2>/dev/null | jq -r 'select(.toolDenialKind != null) | .toolDenialKind' 2>/dev/null | sort | uniq -c | sort -rn
