#!/usr/bin/env bash
# Pick a Go package with fzf, type its new name in the editor, rename package + directory + references.
set -euo pipefail

driver="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/go-rename-package.py"

die() { printf '%s\n' "$*" >&2; exit 1; }

for tool in go gopls fzf python3; do
  command -v "$tool" >/dev/null || die "missing $tool"
done

root="${1:-$PWD}"
gomod="$(cd "$root" && go env GOMOD)"
[ -n "$gomod" ] && [ "$gomod" != "/dev/null" ] || die "no go.mod above $root"
root="$(dirname "$gomod")"
cd "$root"

packages="$(go list -f '{{.ImportPath}}	{{.Name}}	{{.Dir}}' ./... 2>/dev/null)" ||
  die "go list failed — fix the build before renaming"
[ -n "$packages" ] || die "no packages under $root"

selected="$(printf '%s\n' "$packages" |
  column -t -s '	' |
  fzf --prompt='package to rename > ' --height=60% --reverse)" || exit 130
read -r import_path old_name dir <<<"$selected"

clause_file="$(grep -ls "^package ${old_name}\$" "$dir"/*.go | head -1)" ||
  die "no package clause for $old_name in $dir"
[ -n "$clause_file" ] || die "no package clause for $old_name in $dir"
line="$(grep -n "^package ${old_name}\$" "$clause_file" | head -1 | cut -d: -f1)"
col=9

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
name_file="$scratch/package-name"
printf '%s\n' "$old_name" >"$name_file"
"${EDITOR:-hx}" "$name_file"
new_name="$(head -1 "$name_file" | tr -d '[:space:]')"

[ -n "$new_name" ] || die "no new name given"
[ "$new_name" != "$old_name" ] || die "name unchanged"
[[ "$new_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "not a Go identifier: $new_name"
new_dir="$(dirname "$dir")/$new_name"
[ ! -e "$new_dir" ] || die "$new_dir already exists"

git_flag=()
git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1 && git_flag=(--git)

printf 'renaming %s -> %s (%s)\n' "$import_path" "$new_name" "$new_dir" >&2
python3 "$driver" \
  --root "$root" --file "$clause_file" --line "$line" --col "$col" \
  --new-name "$new_name" "${git_flag[@]}"

go build ./... >/dev/null || die "rename applied but the module no longer builds"
printf 'done: %s\n' "$new_dir" >&2
