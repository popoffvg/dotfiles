#!/usr/bin/env bash
# Search the worktree with cgrep, pick a match in fzf, open it in Zed.
# Mode `types` lists type definitions once and filters them fuzzily.
# Mode `code` runs cgrep again on each query change, in code only.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
usage: cgrep-search.sh <types|code> [dir]

  types  pick a type definition (type, struct, class, interface, ...)
  code   search code tokens, skipping comments and string literals

The query starts from $ZED_SELECTED_TEXT when Zed sets it.
EOF
  exit 2
}

type_keywords=(type struct class interface enum trait union protocol record data newtype)
skipped_file_types=(markdown txt rst asciidoc org tex json jsonl yaml toml xml csv svg lock license minified)

mode=${1:-}
search_root=${2:-${ZED_WORKTREE_ROOT:-$PWD}}
[[ $mode == types || $mode == code ]] || usage

for tool in cgrep fzf rg bat zed; do
  command -v "$tool" >/dev/null || { echo "cgrep-search: $tool is not installed" >&2; exit 1; }
done

cd "$search_root"

# cgrep reads no .gitignore and applies --kind only when it walks a directory itself,
# so rg lists the files to search.
rg_type_filters=()
for file_type in "${skipped_file_types[@]}"; do rg_type_filters+=(-T "$file_type"); done
source_files=$(mktemp -t cgrep-search)
trap 'rm -f "$source_files"' EXIT
rg --files --hidden -g '!.git' "${rg_type_filters[@]}" -0 >"$source_files"

# cgrep prints a binary file as an error on stderr, and splits some minified lines
# into rows with no file:line:col prefix.
match_filter="2>/dev/null | grep -E '^[^:]+:[0-9]+:[0-9]+:' || true"

initial_query=${ZED_SELECTED_TEXT:-}
initial_query=${initial_query%%$'\n'*}

fzf_common=(
  --with-shell 'bash -c'
  --delimiter :
  --query "$initial_query"
  --preview 'bat --color=always --style=numbers --highlight-line {2} -- {1}'
  --preview-window 'right,55%,+{2}+3/3'
)

case $mode in
types)
  type_pattern="($(IFS='|'; echo "${type_keywords[*]}")) +[A-Za-z_][A-Za-z0-9_]*"
  type_search="xargs -0 cgrep -c -G --no-color -- '$type_pattern' <'$source_files' $match_filter"
  # Show the text from the match column, so a long line cannot win the fuzzy rank.
  from_match_column='{ text = $0; sub(/^[^:]+:[0-9]+:[0-9]+:/, "", text); print $1 ":" $2 ":" $3 ":" substr(text, $3, 120) }'
  pick=$(bash -c "$type_search" | awk -F: "$from_match_column" |
    fzf "${fzf_common[@]}" --prompt 'type> ') || exit 0
  ;;
code)
  code_search="xargs -0 cgrep -c --no-color -- {q} <'$source_files' $match_filter"
  pick=$(fzf "${fzf_common[@]}" --disabled --prompt 'code> ' \
    --bind "start:reload:$code_search" \
    --bind "change:reload:$code_search" </dev/null) || exit 0
  ;;
esac

IFS=: read -r file line column _ <<<"$pick"
zed --existing "$file:$line:$column"
