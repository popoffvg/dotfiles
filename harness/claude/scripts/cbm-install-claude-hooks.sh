#!/usr/bin/env bash
# Install codebase-memory-mcp's Claude Code hooks when ~/.claude/hooks and
# ~/.claude/settings.json are symlinks into a dotfiles repo.
#
# The installer refuses to write through a symlink ("does not exist or cannot
# be inspected"), so run it against a scratch HOME, then copy the produced hook
# scripts and merge the settings.json hook entries into the real dotfiles.
#
# Usage: cbm-install-claude-hooks.sh [--dry-run]

set -euo pipefail

BIN="${CBM_BIN:-$HOME/.local/bin/codebase-memory-mcp}"
REAL_SETTINGS="$(readlink -f "$HOME/.claude/settings.json")"
REAL_HOOKS="$(readlink -f "$HOME/.claude/hooks")"
SCRATCH="${TMPDIR:-/tmp}/cbm-scratch-home"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

[[ -x "$BIN" ]] || { echo "missing binary: $BIN" >&2; exit 1; }
[[ -d "$REAL_HOOKS" ]] || { echo "missing hooks dir: $REAL_HOOKS" >&2; exit 1; }
[[ -f "$REAL_SETTINGS" ]] || { echo "missing settings: $REAL_SETTINGS" >&2; exit 1; }

rm -rf "$SCRATCH"
mkdir -p "$SCRATCH/.claude/hooks" "$SCRATCH/.claude/agents" "$SCRATCH/.claude/skills"
echo '{}' > "$SCRATCH/.claude/settings.json"
echo '{"mcpServers":{}}' > "$SCRATCH/.claude.json"

echo "== running installer against scratch HOME=$SCRATCH"
HOME="$SCRATCH" "$BIN" install -y >"$SCRATCH/install.log" 2>&1 || true
grep -iE '^error' "$SCRATCH/install.log" || true

shopt -s nullglob
scripts=("$SCRATCH"/.claude/hooks/cbm-*)
shopt -u nullglob
if [[ ${#scripts[@]} -eq 0 ]]; then
  echo "no cbm-* hook scripts produced; see $SCRATCH/install.log" >&2
  exit 1
fi

echo "== hook scripts produced:"
printf '  %s\n' "${scripts[@]##*/}"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "== settings.json hook entries the installer added:"
  python3 - "$SCRATCH/.claude/settings.json" <<'PY'
import json, sys
print(json.dumps(json.load(open(sys.argv[1])).get("hooks", {}), indent=2))
PY
  echo "(dry run — nothing copied)"
  exit 0
fi

cp -p "${scripts[@]}" "$REAL_HOOKS/"
chmod +x "$REAL_HOOKS"/cbm-*

# The scratch run bakes its own throwaway binary path into each script.
perl -pi -e "s{^BIN='.*'\$}{BIN='$BIN'}" "$REAL_HOOKS"/cbm-*
echo "== copied into $REAL_HOOKS (BIN repointed to $BIN)"

cp -p "$REAL_SETTINGS" "$REAL_SETTINGS.bak.$(date +%s)"

python3 - "$SCRATCH/.claude/settings.json" "$REAL_SETTINGS" <<'PY'
import json, sys

src = json.load(open(sys.argv[1])).get("hooks", {})
dst_path = sys.argv[2]
dst = json.load(open(dst_path))
dst.setdefault("hooks", {})

def is_cbm(matcher_block):
    return "cbm-" in json.dumps(matcher_block)

added = 0
for event, blocks in src.items():
    existing = dst["hooks"].setdefault(event, [])
    existing_json = json.dumps(existing)
    for block in blocks:
        if not is_cbm(block):
            continue
        if json.dumps(block) in existing_json:
            continue
        existing.append(block)
        added += 1

json.dump(dst, open(dst_path, "w"), indent=2)
open(dst_path, "a").write("\n")
print(f"== merged {added} hook block(s) into {dst_path}")
PY
