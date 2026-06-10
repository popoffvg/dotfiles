#!/usr/bin/env bash
# Install the locally-built tengo-lsp release binary over every consumer:
#   - VS Code extension bundled binary (what the extension uses first)
#   - ~/.local/bin (Zed downloads to its own dir, but PATH consumers use this)
#   - /usr/local/bin (legacy PATH location)
# Idempotent; ad-hoc re-signs on arm64 macOS so Gatekeeper doesn't kill it.
set -euo pipefail

SRC="${1:-$HOME/Documents/git/tengo-lsp/target/release/tengo-lsp}"
[ -f "$SRC" ] || { echo "missing build: $SRC (run: cargo build --release)"; exit 1; }

install_one() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cp -f "$SRC" "$dest"
  chmod 755 "$dest"
  codesign --force --sign - "$dest" 2>/dev/null || true   # arm64: ad-hoc re-sign
  echo "installed -> $dest"
}

# VS Code: every installed popoffvg.tengo-* extension that bundles a binary.
for ext in "$HOME"/.vscode/extensions/popoffvg.tengo-*; do
  [ -f "$ext/server/tengo-lsp" ] && install_one "$ext/server/tengo-lsp"
done

install_one "$HOME/.local/bin/tengo-lsp"
# /usr/local/bin usually needs sudo; best-effort only.
[ -w /usr/local/bin ] && install_one "/usr/local/bin/tengo-lsp" || echo "skip /usr/local/bin (needs sudo)"

echo "version check:"; "$SRC" --help >/dev/null 2>&1 && echo "  binary runs OK"
