#!/usr/bin/env bash
# Run the repo linter and reviewrules over <base>..HEAD; on success, write the stamp that the pre-push-gate hook reads.
set -euo pipefail

usage() {
  echo "usage: pre-push-check.sh [--repo DIR] [--base REF] [--lint CMD] [--skip-review REASON] | --print-stamp" >&2
  exit 2
}

repo=.
base=
lint_cmd=
skip_review=
print_stamp=
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) repo=$2; shift 2 ;;
    --base) base=$2; shift 2 ;;
    --lint) lint_cmd=$2; shift 2 ;;
    --skip-review) skip_review=$2; shift 2 ;;
    --print-stamp) print_stamp=1; shift ;;
    *) usage ;;
  esac
done

root=$(git -C "$repo" rev-parse --show-toplevel)
cd "$root"
head=$(git rev-parse HEAD)
out="$HOME/.cache/claude-pre-push/$head"
[ -z "$print_stamp" ] || { echo "$out/stamp"; exit 0; }
if [ -z "$base" ]; then
  base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD || echo origin/main)
fi
git rev-parse --verify --quiet "$base" >/dev/null || { echo "pre-push-check: base $base not found; pass --base" >&2; exit 2; }

# Each row: the file that marks the linter, the test that the repo really defines it, the command. {base} is the diff base.
LINTERS=(
  "mise.toml|mise tasks ls 2>/dev/null | grep -qw '^lint'|mise run lint"
  ".mise.toml|mise tasks ls 2>/dev/null | grep -qw '^lint'|mise run lint"
  "Taskfile.yml|task --list-all 2>/dev/null | grep -qE '^\\* lint:'|task lint"
  "Makefile|grep -qE '^lint:' Makefile|make lint"
  ".pre-commit-config.yaml|true|pre-commit run --from-ref {base} --to-ref HEAD"
  ".golangci.yml|go tool golangci-lint version >/dev/null 2>&1|go tool golangci-lint run --new-from-rev={base} ./..."
  ".golangci.yaml|go tool golangci-lint version >/dev/null 2>&1|go tool golangci-lint run --new-from-rev={base} ./..."
  "pnpm-lock.yaml|jq -e .scripts.lint package.json >/dev/null|pnpm lint"
  "yarn.lock|jq -e .scripts.lint package.json >/dev/null|yarn lint"
  "package-lock.json|jq -e .scripts.lint package.json >/dev/null|npm run lint"
  "Cargo.toml|true|cargo clippy --all-targets -- -D warnings"
)

if [ -z "$lint_cmd" ]; then
  for row in "${LINTERS[@]}"; do
    IFS='|' read -r marker probe cmd <<<"$row"
    [ -f "$marker" ] && bash -c "$probe" && { lint_cmd=${cmd//\{base\}/$base}; break; }
  done
fi
[ -n "$lint_cmd" ] || { echo "pre-push-check: no linter found in $root; pass --lint CMD with the command CI runs" >&2; exit 2; }

mkdir -p "$out"
rm -f "$out/stamp"
echo "pre-push-check: lint: $lint_cmd" >&2
bash -c "$lint_cmd" || { echo "pre-push-check: lint failed; fix the findings and run again" >&2; exit 1; }

review_line="reviewrules: skipped: $skip_review"
if [ -z "$skip_review" ]; then
  echo "pre-push-check: reviewrules --base $base, report in $out/report.md" >&2
  rc=0
  # reviewrules sends the key sk-local when LITELLM_API_KEY is empty, and the proxy rejects it; a session started before zshenv set the key has none.
  if [ -z "${LITELLM_API_KEY:-}" ] && [ -r "$HOME/.config/litellm/.env" ]; then
    LITELLM_API_KEY=$(. "$HOME/.config/litellm/.env"; printf '%s' "$LITELLM_MASTER_KEY")
    export LITELLM_API_KEY
  fi
  reviewrules --repo "$root" --base "$base" --json-out "$out/reviewrules.json" \
    >"$out/report.md" 2>"$out/reviewrules.log" || rc=$?
  cat "$out/report.md"
  [ "$rc" -eq 0 ] || { echo "pre-push-check: reviewrules exit $rc (1 = a rule FAIL, 2 = the run did not finish); fix the cause (see $out/report.md, $out/reviewrules.log) and run again" >&2; exit 1; }
  grep -q 'WARN' "$out/report.md" && echo "pre-push-check: verify every WARN line in $out/report.md before the push" >&2
  review_line="reviewrules: $out/report.md"
fi

printf 'repo: %s\nbase: %s\nlint: %s\n%s\n' "$root" "$base" "$lint_cmd" "$review_line" >"$out/stamp"
echo "pre-push-check: ok for $head; the push may run" >&2
