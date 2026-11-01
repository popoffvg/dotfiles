#!/usr/bin/env bash
# greptile-rule-review.sh starts one pi agent per .greptile/config.json rule as a bg task.
# Each agent checks the branch diff against its one rule and writes PASS or FAIL to <out>/<rule-id>.md.
set -euo pipefail

usage() {
  echo "usage: greptile-rule-review.sh [--dry-run] [<base-ref>]   (default base: origin/main)" >&2
  echo "env: GREPTILE_REVIEW_PROVIDER (amazon-bedrock), GREPTILE_REVIEW_MODEL (openai.gpt-oss-120b)" >&2
  exit 2
}

dry_run=0
base=origin/main
for arg in "$@"; do
  case $arg in
    --dry-run) dry_run=1 ;;
    -h|--help) usage ;;
    *) base=$arg ;;
  esac
done

provider=${GREPTILE_REVIEW_PROVIDER:-amazon-bedrock}
# A "provider/id:N" model string makes pi read ":N" as a thinking level, so pass the id without the ":0" suffix.
model=${GREPTILE_REVIEW_MODEL:-openai.gpt-oss-120b}

repo=$(git rev-parse --show-toplevel)
config=$repo/.greptile/config.json
[[ -f $config ]] || { echo "greptile-rule-review: no .greptile/config.json in $repo" >&2; exit 1; }
if (( ! dry_run )); then
  command -v background >/dev/null || { echo "greptile-rule-review: bg binary 'background' is not on PATH" >&2; exit 1; }
  command -v pi >/dev/null || { echo "greptile-rule-review: pi is not on PATH" >&2; exit 1; }
fi

out=${TMPDIR:-/tmp}/greptile-rule-review/$(date +%Y%m%d-%H%M%S)
mkdir -p "$out"
git -C "$repo" diff "$base"...HEAD > "$out/diff.patch"
changed=$(git -C "$repo" diff --name-only "$base"...HEAD)
[[ -n $changed ]] || { echo "greptile-rule-review: no change between $base and HEAD" >&2; exit 1; }

# rule_matches_changed_file is true when a changed file matches one scope glob, or when the rule has no scope.
# Inside [[ ]] a "*" also matches "/", so dropping "**/" keeps "**/*.go" matching "main.go" at the repo root.
rule_matches_changed_file() {
  local scopes=$1 pattern file
  [[ -z $scopes ]] && return 0
  while IFS= read -r pattern; do
    pattern=${pattern//\*\*\//}
    while IFS= read -r file; do
      # shellcheck disable=SC2053
      [[ $file == $pattern ]] && return 0
    done <<< "$changed"
  done <<< "$scopes"
  return 1
}

started=0
while IFS= read -r row; do
  id=$(jq -r .id <<< "$row")
  scopes=$(jq -r '(.scope // [])[]' <<< "$row")
  if ! rule_matches_changed_file "$scopes"; then
    echo "skip  $id (no changed file in scope)"
    continue
  fi
  prompt="You check one git diff against ONE review rule of this repo. Ignore every other problem.
Rule id: $id
Severity: $(jq -r '.severity // "medium"' <<< "$row")
Rule: $(jq -r .rule <<< "$row")

The diff is attached. Read the repo files the rule names, and read changed files when the diff alone is not enough.
Report a violation only in lines the diff adds or changes.
Answer format: the first line is PASS or FAIL. After FAIL, one line per violation: <file>:<line> — <what breaks the rule>. Write nothing else."
  if (( dry_run )); then
    echo "run   $id"
    continue
  fi
  background -- sh -c 'cd "$1" && pi -p --no-session --no-context-files --no-skills --no-extensions --no-prompt-templates \
      --tools read,grep,find,ls --provider "$2" --model "$3" "@$4" "$5" | tee "$6"' \
    _ "$repo" "$provider" "$model" "$out/diff.patch" "$prompt" "$out/$id.md"
  started=$((started + 1))
done < <(jq -c '.rules[]' "$config")

echo "out: $out"
(( dry_run )) || echo "started $started bg tasks; results: head -n 3 $out/*.md"
