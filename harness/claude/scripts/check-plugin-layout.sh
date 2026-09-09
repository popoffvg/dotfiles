#!/usr/bin/env bash
# Check one harness plugin's source dir against the layout rules in
# ~/git/dotfiles/CLAUDE.md § Plugins, § Local Plugin Development, § Dev Conventions.
#
# Read-only and idempotent. Prints one OK/FAIL line per check; exits 1 on any FAIL.
#
# Usage: check-plugin-layout.sh <plugin-dir> [--quiet]
#   --quiet   print only the FAIL lines and the summary
set -uo pipefail

dir="${1:-}"
quiet=0
[ "${2:-}" = "--quiet" ] && quiet=1

if [ -z "$dir" ] || [ ! -d "$dir" ]; then
  echo "usage: check-plugin-layout.sh <plugin-dir> [--quiet]" >&2
  exit 2
fi
command -v jq >/dev/null || { echo "missing dependency: jq" >&2; exit 2; }

dir="$(cd "$dir" && pwd)"
plugin="$(basename "$dir")"
fails=0

ok()   { [ "$quiet" = 1 ] || printf 'OK    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails + 1)); }

# frontmatter field of a markdown file: first `key: value` inside the leading --- block
fm() {
  awk -v key="$2" '
    NR==1 && $0!="---" { exit }
    NR>1 && $0=="---" { exit }
    NR>1 { if (index($0, key ":") == 1) { sub("^" key ":[ \t]*", ""); print; exit } }
  ' "$1"
}

# --- manifest -------------------------------------------------------------
manifest="$dir/.claude-plugin/plugin.json"
if [ ! -f "$manifest" ]; then
  fail "no manifest at .claude-plugin/plugin.json"
elif ! jq -e . "$manifest" >/dev/null 2>&1; then
  fail "plugin.json does not parse as JSON"
else
  name="$(jq -r '.name // ""' "$manifest")"
  if [ "$name" = "$plugin" ]; then
    ok "plugin.json name '$name' matches the directory"
  else
    fail "plugin.json name '$name' does not match the directory '$plugin'"
  fi
  [ -n "$(jq -r '.version // ""' "$manifest")" ] \
    && ok "plugin.json carries a version" \
    || fail "plugin.json carries no version — the pre-commit bump needs one"
fi

# --- markdown-only, self-contained ---------------------------------------
compiled="$(find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name 'package.json' -o -name 'tsconfig.json' \) -print 2>/dev/null)"
if [ -z "$compiled" ]; then
  ok "no TypeScript and no node package in the plugin dir"
else
  fail "compiled sources belong in harness/apps/<name>/, not in the plugin dir:"
  printf '        %s\n' $compiled
fi

links="$(find "$dir" -type l -print 2>/dev/null)"
if [ -z "$links" ]; then
  ok "no symlinks — the plugin cache copies without following them"
else
  fail "symlinks do not survive the plugin cache copy:"
  printf '        %s\n' $links
fi

traversal="$(grep -rlF '../' "$dir" --include='*.json' 2>/dev/null)"
if [ -z "$traversal" ]; then
  ok "no parent-dir path in any config file"
else
  fail "the cache blocks '../' — rewrite these against \${CLAUDE_PLUGIN_ROOT}:"
  printf '        %s\n' $traversal
fi

# --- commands: the filename is the command name --------------------------
cmd_bad=0
cmd_seen=0
for f in "$dir"/commands/*.md; do
  [ -f "$f" ] || continue
  cmd_seen=$((cmd_seen + 1))
  stem="$(basename "$f" .md)"
  declared="$(fm "$f" name)"
  if [ -n "$declared" ] && [ "$declared" != "$stem" ]; then
    fail "commands/$stem.md declares name '$declared' — Claude Code registers the filename, so the two must agree"
    cmd_bad=$((cmd_bad + 1))
  fi
  [ -n "$(fm "$f" description)" ] || { fail "commands/$stem.md carries no description"; cmd_bad=$((cmd_bad + 1)); }
done
[ "$cmd_seen" -gt 0 ] && [ "$cmd_bad" = 0 ] && ok "$cmd_seen command file(s): every name matches its filename and carries a description"

# --- skills: a colon in a plugin skill dir normalizes to a dash ----------
skill_bad=0
skill_seen=0
for f in "$dir"/skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  skill_seen=$((skill_seen + 1))
  sdir="$(basename "$(dirname "$f")")"
  registers="${sdir//:/-}"
  declared="$(fm "$f" name)"
  if [ -z "$declared" ] || [ -z "$(fm "$f" description)" ]; then
    fail "skills/$sdir/SKILL.md needs both name and description in frontmatter"
    skill_bad=$((skill_bad + 1))
  elif [ "$declared" != "$registers" ]; then
    fail "skills/$sdir/SKILL.md declares name '$declared' but registers as '$registers'"
    skill_bad=$((skill_bad + 1))
  fi
done
[ "$skill_seen" -gt 0 ] && [ "$skill_bad" = 0 ] && ok "$skill_seen skill(s): every name matches the name it registers under"

# --- hooks: every command a hook names must exist and run ----------------
hooks="$dir/hooks/hooks.json"
if [ -f "$hooks" ]; then
  if ! jq -e . "$hooks" >/dev/null 2>&1; then
    fail "hooks/hooks.json does not parse as JSON"
  else
    hook_bad=0
    hook_seen=0
    while IFS= read -r cmd; do
      [ -n "$cmd" ] || continue
      hook_seen=$((hook_seen + 1))
      path="${cmd%% *}"
      path="${path//\$\{CLAUDE_PLUGIN_ROOT\}/$dir}"
      case "$path" in
        "$dir"/*)
          [ -x "$path" ] || { fail "hooks/hooks.json names $path, which is missing or not executable"; hook_bad=$((hook_bad + 1)); } ;;
        *)
          command -v "$path" >/dev/null || { fail "hooks/hooks.json names '$path', which is not on PATH"; hook_bad=$((hook_bad + 1)); } ;;
      esac
    done < <(jq -r '.hooks | to_entries[] | .value[] | .hooks[]? | select(.type=="command") | .command' "$hooks" 2>/dev/null)
    [ "$hook_bad" = 0 ] && ok "$hook_seen hook command(s): every one exists and is executable"
  fi
fi

# --- MCP: a binary name, built from harness/apps/<name> ------------------
mcp="$dir/.mcp.json"
if [ -f "$mcp" ]; then
  if ! jq -e . "$mcp" >/dev/null 2>&1; then
    fail ".mcp.json does not parse as JSON"
  else
    mcp_bad=0
    while IFS= read -r bin; do
      [ -n "$bin" ] || continue
      case "$bin" in
        */*) fail ".mcp.json names '$bin' by path — name the binary only, built to ~/.local/bin by its mise task"
             mcp_bad=$((mcp_bad + 1)) ;;
        *)   command -v "$bin" >/dev/null \
               || { fail ".mcp.json names '$bin', which is not on PATH — run its harness/apps build task"
                    mcp_bad=$((mcp_bad + 1)); } ;;
      esac
    done < <(jq -r '.mcpServers | to_entries[] | .value.command // empty' "$mcp" 2>/dev/null)
    [ "$mcp_bad" = 0 ] && ok "every .mcp.json server names a binary that resolves on PATH"
  fi
fi

# --- summary --------------------------------------------------------------
if [ "$fails" = 0 ]; then
  echo "PASS  $plugin layout clean"
  exit 0
fi
echo "FAIL  $plugin: $fails problem(s)"
exit 1
