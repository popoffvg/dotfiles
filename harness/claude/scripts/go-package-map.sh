#!/usr/bin/env bash
# Print a markdown map of what a Go module already offers to one target directory:
# the imports the target uses (with file counts), the direct go.mod deps it never imports,
# and the exported symbols of the module's own helper packages.
set -euo pipefail

usage() { echo "usage: $0 <module-root> <target-dir> [internal-dir...]" >&2; exit 2; }
[ $# -ge 2 ] || usage
root=$1; target=$2; shift 2
internal=("$@")
[ ${#internal[@]} -gt 0 ] || internal=(util pkg internal)

cd "$root"
[ -f go.mod ] || { echo "no go.mod in $root" >&2; exit 2; }
module=$(awk '/^module /{print $2; exit}' go.mod)

echo "# Package map — $module, target $target"
echo
echo "## Imports the target uses (files per import, non-test)"
find "$target" -name '*.go' -not -name '*_test.go' -print0 \
  | xargs -0 grep -hoE '^\s*(import\s+)?(\w+\s+)?"[a-z0-9.-]+\.[a-z]+/[^"]+"' \
  | grep -oE '"[^"]+"' | sort | uniq -c | sort -rn
echo
echo "## Direct go.mod deps the target never imports"
awk '/^require \(/{f=1;next} /^\)/{f=0} f && !/indirect/ && !/^\s*\/\//{print $1}' go.mod \
  | while read -r dep; do
      grep -rqF "\"$dep" "$target" --include='*.go' || echo "- $dep"
    done
echo
echo "## Module helper packages — doc line and exported names"
for top in "${internal[@]}"; do
  [ -d "$top" ] || continue
  find "$top" -type d -maxdepth 3 | sort | while read -r dir; do
    files=$(find "$dir" -maxdepth 1 -name '*.go' -not -name '*_test.go')
    [ -n "$files" ] || continue
    doc=$(grep -h -m1 '^// Package' $files 2>/dev/null | head -1 || true)
    names=$( { grep -hoE '^(func|type) [A-Z][A-Za-z0-9_]*' $files | awk '{print $2}' | sort -u | head -20 || true; } | tr "\n" " ")
    if [ -n "$names" ]; then echo "- \`$dir\` — ${doc:-(no doc)} — $names"; fi
  done
done
