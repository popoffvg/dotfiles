#!/usr/bin/env bash
# Load one harness plugin straight from its source dir in a headless Claude session,
# then report what registered and what fired.
#
# `--plugin-dir` overrides an installed copy of the same plugin: a plugin already
# installed from the marketplace shows up as `<name>@inline`, once, pointing at the
# source dir. So this reads the working tree, never ~/.claude/plugins/cache.
#
# The session still loads every OTHER installed plugin, this user's settings, and
# their global hooks. Isolation here means "the plugin under test comes from the
# source dir", not "nothing else is loaded".
#
# Usage: probe-harness-plugin.sh <plugin-dir> [options]
#   --prompt TEXT   what to send (default: a prompt that asks for the marker)
#   --expect TEXT   exit 1 unless the reply contains TEXT (default: PLUGIN-PROBE-OK)
#   --hook-marker TEXT
#                   exit 1 unless some hook's output contains TEXT. A hook_response
#                   record names the event, not the script, so a marker the hook
#                   echoes is the only proof that THIS plugin's hook ran.
#   --cwd DIR       where the session runs (default: a fresh temp dir, so project
#                   settings and a project CLAUDE.md cannot answer for the plugin)
#   --model NAME    model for the session (default: sonnet)
#   --out FILE      keep the stream-json transcript here (default: a temp file, printed)
#   --timeout SECS  give up after this long (default: 180)
#
# Exit 0 = the plugin loaded from the source dir AND the reply contains --expect.
set -uo pipefail

dir="${1:-}"
shift || true
prompt=""
expect="PLUGIN-PROBE-OK"
hook_marker=""
cwd=""
model="sonnet"
out=""
timeout_s=180

while [ $# -gt 0 ]; do
  case "$1" in
    --prompt)  prompt="$2";    shift 2 ;;
    --expect)  expect="$2";    shift 2 ;;
    --hook-marker) hook_marker="$2"; shift 2 ;;
    --cwd)     cwd="$2";       shift 2 ;;
    --model)   model="$2";     shift 2 ;;
    --out)     out="$2";       shift 2 ;;
    --timeout) timeout_s="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$dir" ] || [ ! -d "$dir" ]; then
  echo "usage: probe-harness-plugin.sh <plugin-dir> [--prompt TEXT] [--expect TEXT] [--hook-marker TEXT] [--cwd DIR] [--model NAME] [--out FILE] [--timeout SECS]" >&2
  exit 2
fi
for dep in claude jq; do
  command -v "$dep" >/dev/null || { echo "missing dependency: $dep" >&2; exit 2; }
done

dir="$(cd "$dir" && pwd)"
plugin="$(jq -r '.name // ""' "$dir/.claude-plugin/plugin.json" 2>/dev/null)"
[ -n "$plugin" ] || { echo "no plugin name in $dir/.claude-plugin/plugin.json" >&2; exit 2; }

[ -n "$prompt" ] || prompt="Reply with exactly $expect and nothing else."
[ -n "$cwd" ] || cwd="$(mktemp -d "${TMPDIR:-/tmp}/plugin-probe-XXXXXX")"
[ -n "$out" ] || out="$(mktemp "${TMPDIR:-/tmp}/plugin-probe-jsonl-XXXXXX")"

# macOS ships neither `timeout` nor `gtimeout` by default; run bare when neither is there.
limit=()
if command -v timeout >/dev/null; then
  limit=(timeout "${timeout_s}s")
elif command -v gtimeout >/dev/null; then
  limit=(gtimeout "${timeout_s}s")
fi

cd "$cwd" || exit 2
"${limit[@]}" claude \
  --plugin-dir "$dir" \
  --model "$model" \
  --output-format stream-json \
  --include-hook-events \
  --verbose \
  -p "$prompt" > "$out" 2>/dev/null
run_status=$?

if [ ! -s "$out" ]; then
  echo "FAIL  the session wrote no transcript (exit $run_status)"
  exit 1
fi

fails=0
fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails + 1)); }

echo "transcript: $out"
echo "cwd:        $cwd"
echo

# --- did it load from the source dir? ------------------------------------
loaded="$(jq -r --arg n "$plugin" --arg d "$dir" '
  select(.subtype=="init") | .plugins[]? | select(.name==$n)
  | (if .path==$d then "inline" else "cache:" + .path end)' "$out" | sort -u)"
case "$loaded" in
  inline) printf 'OK    %s loaded from %s\n' "$plugin" "$dir" ;;
  "")     fail "$plugin does not appear in the session's plugin list" ;;
  *)      fail "$plugin loaded from somewhere else: $loaded" ;;
esac

# --- what the plugin registered ------------------------------------------
for kind in slash_commands skills agents; do
  names="$(jq -r --arg n "$plugin" \
    "select(.subtype==\"init\") | .$kind[]? | tostring | select(startswith(\$n + \":\"))" \
    "$out" | sort -u | tr '\n' ' ')"
  if [ -n "$names" ]; then
    printf 'OK    %-14s %s\n' "$kind" "$names"
  else
    printf '      %-14s none\n' "$kind"
  fi
done

# Only the servers this plugin declares — the session also carries the user's own.
if [ -f "$dir/.mcp.json" ]; then
  while IFS= read -r want; do
    [ -n "$want" ] || continue
    status="$(jq -r --arg s "$want" 'select(.subtype=="init") | .mcp_servers[]? | select(.name==$s) | .status' "$out" | head -1)"
    case "$status" in
      connected) printf 'OK    %-14s %s connected\n' "mcp_server" "$want" ;;
      "")        fail "mcp server '$want' never appeared in the session" ;;
      *)         fail "mcp server '$want' is $status" ;;
    esac
  done < <(jq -r '.mcpServers | keys[]?' "$dir/.mcp.json" 2>/dev/null)
fi

# --- which hooks fired, and how they ended --------------------------------
echo
hook_lines="$(jq -r 'select(.subtype=="hook_response")
  | [.hook_name, (.exit_code|tostring), .outcome, ((.output // "") | gsub("\n"; " ") | .[0:80])]
  | @tsv' "$out")"
if [ -n "$hook_lines" ]; then
  echo "hooks that fired:"
  printf '%s\n' "$hook_lines" | awk -F'\t' '{printf "  %-28s exit=%-3s %-8s %s\n", $1, $2, $3, $4}'
  bad="$(printf '%s\n' "$hook_lines" | awk -F'\t' '$3 != "success"' | wc -l | tr -d ' ')"
  [ "$bad" != 0 ] && fail "$bad hook run(s) did not end in success"
else
  echo "hooks that fired: none"
fi

if [ -n "$hook_marker" ]; then
  if jq -r 'select(.subtype=="hook_response") | (.output // "") + (.stderr // "") + (.stdout // "")' "$out" \
       | grep -qF -- "$hook_marker"; then
    printf 'OK    a hook echoed %s\n' "$hook_marker"
  else
    fail "no hook output carried '$hook_marker'"
  fi
fi

# --- what the model replied ----------------------------------------------
echo
reply="$(jq -r 'select(.type=="assistant") | .message.content[]? | .text? // empty' "$out")"
echo "reply:"
printf '%s\n' "$reply" | sed 's/^/  /'
echo

if printf '%s' "$reply" | grep -qF -- "$expect"; then
  printf 'OK    reply contains %s\n' "$expect"
else
  fail "reply does not contain '$expect'"
fi

[ "$run_status" = 0 ] || fail "claude exited $run_status"

if [ "$fails" = 0 ]; then
  echo "PASS  $plugin"
  exit 0
fi
echo "FAIL  $plugin: $fails problem(s)"
exit 1
