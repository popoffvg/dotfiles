#!/usr/bin/env bash
# Run mdshow whatever PATH the host gave this session.
#
# Claude Code started from a terminal inherits the shell PATH. Started by Zed as
# an ACP agent, or by the desktop app, it gets the GUI PATH — no ~/.local/bin and
# no node — so a bare `mdshow` is not found, and even finding it fails because
# its `#!/usr/bin/env node` shebang cannot resolve node either. Both are located
# here. Every argument is passed through untouched.
set -uo pipefail

NODE_CANDIDATES=(
  "$HOME/.local/share/mise/shims/node"
  "/opt/nanobrew/prefix/bin/node"
  "/opt/homebrew/bin/node"
  "/usr/local/bin/node"
)

ENTRY_CANDIDATES=(
  "$HOME/git/dotfiles/harness/apps/mdshow/bin/mdshow.js"
)

find_node() {
  command -v node 2>/dev/null && return 0
  for candidate in "${NODE_CANDIDATES[@]}"; do
    [ -x "$candidate" ] && { printf '%s\n' "$candidate"; return 0; }
  done
  return 1
}

find_entry() {
  for candidate in "${ENTRY_CANDIDATES[@]}"; do
    [ -f "$candidate" ] && { printf '%s\n' "$candidate"; return 0; }
  done
  # An npm-linked `mdshow` is a symlink into the app's bin directory.
  local linked
  linked=$(command -v mdshow 2>/dev/null) || linked=$HOME/.local/bin/mdshow
  if [ -e "$linked" ]; then
    local target
    target=$(cd "$(dirname "$linked")" && readlink "$linked" 2>/dev/null)
    [ -n "$target" ] && [ -f "$(cd "$(dirname "$linked")" && cd "$(dirname "$target")" && pwd)/$(basename "$target")" ] &&
      printf '%s\n' "$(cd "$(dirname "$linked")" && cd "$(dirname "$target")" && pwd)/$(basename "$target")" && return 0
    printf '%s\n' "$linked"
    return 0
  fi
  return 1
}

node_bin=$(find_node)
entry=$(find_entry)

if [ -n "${node_bin:-}" ] && [ -n "${entry:-}" ]; then
  exec "$node_bin" "$entry" "$@"
fi

# stdout, because the caller inlines stdout into the agent's prompt.
cat <<EOF
mdshow could not be started in this session.

  node:  ${node_bin:-not found}
  mdshow: ${entry:-not found}

If mdshow works in a terminal but not here, this session has the GUI PATH (Zed
ACP agent, desktop app) instead of the shell PATH. Tell the reader to run:

  cd ~/git/dotfiles/harness/apps/mdshow && npm install && npm link
EOF
exit 1
