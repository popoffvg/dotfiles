#!/usr/bin/env bash
# Map every well-known pl7.app annotation/domain key to the files that READ it.
# Usage: bash pl-annotation-consumers.sh [platforma-checkout]   (default ~/git/mil/platforma)
# Reads the registry at lib/model/common/src/drivers/pframe/spec/spec.ts, then
# greps the checkout (minus node_modules/dist/build) once per key.
set -uo pipefail
ROOT="${1:-$HOME/git/mil/platforma}"
REG="$ROOT/lib/model/common/src/drivers/pframe/spec/spec.ts"
[ -f "$REG" ] || { echo "registry not found: $REG" >&2; exit 1; }

EX=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.git
    --include=*.ts --include=*.vue --include=*.tengo --include=*.rs)

keys=$(grep -ohE '"pl7\.app/[a-zA-Z0-9/_.-]+"' "$REG" | tr -d '"' | sort -u)
printf '%-44s %3s  %s\n' KEY N FILES
for k in $keys; do
  files=$(grep -rl "${EX[@]}" -- "$k" "$ROOT" 2>/dev/null \
            | grep -v 'pframe/spec/spec.ts' | sed "s|^$ROOT/||" | sort)
  n=$(printf '%s' "$files" | grep -c .)
  printf '%-44s %3s  %s\n' "$k" "$n" "$(echo "$files" | tr '\n' ' ')"
done
