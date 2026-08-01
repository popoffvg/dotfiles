#!/usr/bin/env bash
# Render a local HTML file to PDF with headless Chrome.
# Honors the page's own @media print rules and @page size — so a slide deck that shows one
# section at a time on screen must define a print block that reveals every slide and breaks
# after each, or the PDF will contain only the visible one.
#
# Usage: html-to-pdf.sh <input.html> [output.pdf]
#   e.g. html-to-pdf.sh deck.html deck.pdf
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "usage: $(basename "$0") <input.html> [output.pdf]" >&2
  exit 2
fi

in=$1
out=${2:-${in%.*}.pdf}

[ -f "$in" ] || { echo "no such input file: $in" >&2; exit 1; }

browser=""
for p in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
do
  [ -x "$p" ] && { browser=$p; break; }
done
if [ -z "$browser" ]; then
  for c in chromium chromium-browser google-chrome; do
    command -v "$c" >/dev/null && { browser=$(command -v "$c"); break; }
  done
fi
[ -n "$browser" ] || { echo "no Chrome/Chromium found" >&2; exit 1; }

abs_in=$(cd "$(dirname "$in")" && pwd)/$(basename "$in")
abs_out=$(cd "$(dirname "$out")" && pwd)/$(basename "$out")

# Chrome needs a writable profile dir; never reuse the user's real one.
profile=$(mktemp -d "${TMPDIR:-/tmp}/chrome-pdf.XXXXXX")
trap 'rm -rf "$profile"' EXIT

"$browser" \
  --headless \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --no-pdf-header-footer \
  --user-data-dir="$profile" \
  --virtual-time-budget=8000 \
  --print-to-pdf="$abs_out" \
  "file://$abs_in" >/dev/null 2>&1

[ -s "$abs_out" ] || { echo "chrome produced no output: $abs_out" >&2; exit 1; }

pages=$(strings "$abs_out" | grep -c '^/Type[[:space:]]*/Page$' || true)
echo "wrote $abs_out ($(wc -c <"$abs_out" | tr -d ' ') bytes${pages:+, ~$pages pages})"
