#!/usr/bin/env bash
# Install custom agent icons into Zed's ACP registry icon cache.
#
# Zed downloads a registry agent's icon only when the file is missing
# (crates/project/src/agent_registry_store.rs), so a file placed here is kept
# and never overwritten by a fetch. The cache can still be wiped, which is why
# the real source lives in the dotfiles and this script restores it.
#
# Zed paints these SVGs as a monochrome mask tinted by the theme, so only the
# shape carries over -- any fill in the file is discarded.
set -euo pipefail

SRC="${ZED_AGENT_ICONS_SRC:-$HOME/.config/zed/icons}"
DEST="${ZED_AGENT_ICONS_DEST:-$HOME/Library/Application Support/Zed/external_agents/registry/icons}"
BACKUP="$DEST/.original"

usage() {
  cat <<EOF
usage: ${0##*/} [install|restore|list]

  install   copy every SVG in $SRC into the Zed cache (default)
  restore   put the icons Zed downloaded back
  list      show which icons are currently overridden
EOF
}

require_dirs() {
  [ -d "$SRC" ] || { echo "no icon source dir: $SRC" >&2; exit 1; }
  [ -d "$DEST" ] || { echo "no Zed registry icon dir: $DEST" >&2; exit 1; }
}

install_icons() {
  require_dirs
  mkdir -p "$BACKUP"
  local count=0
  for svg in "$SRC"/*.svg; do
    [ -e "$svg" ] || continue
    local name
    name="$(basename "$svg")"
    if [ -f "$DEST/$name" ] && [ ! -f "$BACKUP/$name" ]; then
      cp "$DEST/$name" "$BACKUP/$name"
      echo "backed up $name"
    fi
    if cmp -s "$svg" "$DEST/$name"; then
      echo "unchanged  $name"
    else
      cp "$svg" "$DEST/$name"
      echo "installed  $name"
    fi
    count=$((count + 1))
  done
  [ "$count" -gt 0 ] || { echo "no SVGs in $SRC" >&2; exit 1; }
  echo "restart Zed to pick up the new icons"
}

restore_icons() {
  [ -d "$BACKUP" ] || { echo "nothing backed up in $BACKUP" >&2; exit 1; }
  for svg in "$BACKUP"/*.svg; do
    [ -e "$svg" ] || continue
    cp "$svg" "$DEST/$(basename "$svg")"
    echo "restored   $(basename "$svg")"
  done
  echo "restart Zed to pick up the restored icons"
}

list_icons() {
  require_dirs
  for svg in "$SRC"/*.svg; do
    [ -e "$svg" ] || continue
    local name status
    name="$(basename "$svg")"
    if cmp -s "$svg" "$DEST/$name"; then status="active"; else status="not installed"; fi
    printf '%-24s %s\n' "$name" "$status"
  done
}

case "${1:-install}" in
  install) install_icons ;;
  restore) restore_icons ;;
  list) list_icons ;;
  -h | --help | help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
