#!/usr/bin/env bash
# Repoint the LadybugDB native binary at this machine's OpenSSL.
# The published lbugjs.node hardlinks /opt/homebrew/opt/openssl@3, which does not
# exist when Homebrew lives elsewhere (nanobrew). Re-run after every gitnexus upgrade.
set -euo pipefail

OPENSSL_LIB="${OPENSSL_LIB:-/opt/nanobrew/prefix/opt/openssl@3/lib}"
BIN="${1:-$(dirname "$(readlink -f "$(command -v gitnexus)")")/../node_modules/@ladybugdb/core/lbugjs.node}"

if [ ! -f "$BIN" ]; then
  echo "native binary not found: $BIN" >&2
  exit 1
fi

for lib in libssl.3.dylib libcrypto.3.dylib; do
  [ -f "$OPENSSL_LIB/$lib" ] || { echo "missing $OPENSSL_LIB/$lib" >&2; exit 1; }
done

changed=0
while read -r old; do
  case "$old" in
    /opt/homebrew/opt/openssl@3/lib/*)
      install_name_tool -change "$old" "$OPENSSL_LIB/$(basename "$old")" "$BIN"
      echo "patched $(basename "$old")"
      changed=1
      ;;
  esac
done < <(otool -L "$BIN" | awk 'NR>1 {print $1}')

if [ "$changed" -eq 0 ]; then
  echo "already patched: $BIN"
  exit 0
fi

codesign --force --sign - "$BIN"
otool -L "$BIN" | grep -E 'ssl|crypto' || true
echo "done: $BIN"
