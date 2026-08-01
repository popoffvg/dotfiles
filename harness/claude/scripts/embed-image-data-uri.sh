#!/usr/bin/env bash
# Inline an image into a text file as a base64 data: URI.
# Use when a self-contained HTML page (e.g. a published Artifact, where a strict CSP blocks
# every external host) must carry its images inline.
#
# Two anchor forms:
#   embed-image-data-uri.sh <target> '@@DEX_PHOTO@@'   dex.jpg   # first embed: replace a literal marker
#   embed-image-data-uri.sh <target> 'alt:Dex Horthy'  dex.jpg   # re-embed: swap the src of <img alt="...">
#
# The alt: form is what you need after the first embed, because the marker is gone by then —
# it rewrites the src of the single-line <img> tag carrying that alt text, however long the
# existing data URI is. Use it whenever the source image file changes.
#
# Idempotent: if the anchor is not present, it reports and exits 0 without touching the file.
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "usage: $(basename "$0") <target-file> <marker|alt:TEXT> <image-file>" >&2
  exit 2
fi

target=$1
anchor=$2
image=$3

[ -f "$target" ] || { echo "no such target file: $target" >&2; exit 1; }
[ -f "$image" ]  || { echo "no such image file: $image" >&2; exit 1; }

# Sniff the real format from the magic bytes — never trust the extension. A file named .jpg is
# routinely an AVIF or HEIC export (macOS/phone screenshots do this), and a wrong mime in the
# data: URI makes the image silently fail to render.
sniff=$(head -c 16 "$image" | xxd -p | tr -d '\n')
case "$sniff" in
  ffd8ff*)              mime=image/jpeg ;;
  89504e47*)            mime=image/png ;;
  47494638*)            mime=image/gif ;;
  *)
    case "$sniff" in
      *6674797061766966*) mime=image/avif ;;   # ftypavif
      *667479706865*)     mime=image/heic ;;   # ftyphei[cf]
      *) case "$(head -c 16 "$image")" in
           RIFF*WEBP*|*WEBP*) mime=image/webp ;;
           *'<svg'*|*'<?xml'*) mime=image/svg+xml ;;
           *) echo "unrecognized image format (magic: ${sniff:0:16}): $image" >&2; exit 1 ;;
         esac ;;
    esac ;;
esac

# HEIC has no browser support; AVIF has no support in older browsers. Warn, do not block.
case "$mime" in
  image/heic) echo "warning: HEIC does not render in browsers — convert to JPEG or PNG first" >&2 ;;
  image/avif) echo "note: embedding as AVIF (renders in current browsers; not in older ones)" >&2 ;;
esac

# Report a genuine extension/content mismatch (jpg vs jpeg and svg+xml are not mismatches).
ext=$(printf '%s' "${image##*.}" | tr '[:upper:]' '[:lower:]')
case "$ext" in jpg) ext=jpeg ;; svg) ext=svg+xml ;; esac
if [ "$ext" != "${mime#image/}" ]; then
  echo "note: $image is really $mime, not the $ext its extension claims" >&2
fi

b64=$(base64 < "$image" | tr -d '\n')
uri="data:${mime};base64,${b64}"

if [ "${anchor#alt:}" != "$anchor" ]; then
  alt=${anchor#alt:}
  if ! grep -qF -- "alt=\"$alt\"" "$target"; then
    echo "no <img> with alt=\"$alt\" in $target, nothing to do"
    exit 0
  fi
  # Rewrite src= inside the one <img ...> tag whose alt matches. Tag must be on one line.
  ALT="$alt" URI="$uri" perl -i -pe '
    BEGIN { $a = $ENV{ALT}; $u = $ENV{URI}; }
    if (/<img\b[^>]*\balt="\Q$a\E"/) {
      s{(<img\b[^>]*\bsrc=")[^"]*(")}{$1 . $u . $2}e;
    }
  ' "$target"
  echo "re-embedded $image as $mime into $target (${#uri} chars) at alt=\"$alt\""
  exit 0
fi

if ! grep -qF -- "$anchor" "$target"; then
  echo "marker not present, nothing to do: $anchor"
  exit 0
fi

# Pass marker and URI through the environment so neither is parsed as a regex or shell word.
MARKER="$anchor" URI="$uri" perl -i -pe '
  BEGIN { $m = $ENV{MARKER}; $u = $ENV{URI}; }
  s/\Q$m\E/$u/g;
' "$target"

echo "embedded $image as $mime into $target (${#uri} chars) replacing $anchor"
