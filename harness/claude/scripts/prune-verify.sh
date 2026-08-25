#!/usr/bin/env bash
# Verify pass for the prune-text skill: pointer resolution, collapse-citation counts,
# and before/after line counts. Deterministic checks only — the verdicts stay with the model.
set -euo pipefail

usage() {
  cat <<'EOF'
prune-verify.sh — deterministic Verify pass for a pruned corpus.

Usage:
  prune-verify.sh <dir> [--base <git-ref>] [--ref <slug>] [--allow <name>]

  <dir>            Directory holding the pruned corpus (searched recursively for *.md).
  --base <ref>     Git ref to diff line counts against. Default: HEAD.
  --ref <slug>     Shared reference basename created by a Phase 1 collapse
                   (e.g. ref-commit-rules.md). Repeatable. Each citing file must
                   name it exactly once.
  --allow <name>   Filename the corpus names as a file to create rather than a
                   pointer to follow (e.g. GLOSSARY.md). Repeatable.

Exit status: 0 all checks pass, 1 a check failed, 2 bad usage.
EOF
}

[[ $# -ge 1 ]] || { usage; exit 2; }
case "${1:-}" in -h|--help) usage; exit 0 ;; esac

dir=$1; shift
base=HEAD
refs=()
allow=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --base) base=${2:?--base needs a ref}; shift 2 ;;
    --ref)  refs+=("${2:?--ref needs a slug}"); shift 2 ;;
    --allow) allow+=("${2:?--allow needs a name}"); shift 2 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done
[[ -d $dir ]] || { echo "not a directory: $dir" >&2; exit 2; }

failed=0
mapfile -t files < <(find "$dir" -type f -name '*.md' | sort)
[[ ${#files[@]} -gt 0 ]] || { echo "no *.md under $dir" >&2; exit 2; }

echo "== Pointers =="
# A pointer is a backticked *.md path, or a "See <file>.md" / "see <file>.md" phrase.
# Resolve relative to the citing file's dir first, then to <dir> and its references/ subdir.
while read -r citing target; do
  [[ -n ${target:-} ]] || continue
  found=""
  for a in "${allow[@]+${allow[@]}}"; do [[ "$target" == "$a" ]] && found=SKIP; done
  [[ $found == SKIP ]] && continue
  for cand in "$(dirname "$citing")/$target" "$dir/$target" "$dir/references/$target"; do
    [[ -f $cand ]] && { found=$cand; break; }
  done
  if [[ -z $found ]]; then
    echo "DANGLING  $citing -> $target"
    failed=1
  fi
done < <(
  for f in "${files[@]}"; do
    grep -oE '`[A-Za-z0-9_./-]+\.md`|[Ss]ee [A-Za-z0-9_./-]+\.md' "$f" 2>/dev/null \
      | sed -E 's/^`//; s/`$//; s/^[Ss]ee //' \
      | while read -r t; do printf '%s %s\n' "$f" "$t"; done
  done
)
[[ $failed -eq 0 ]] && echo "all pointers resolve (${#files[@]} files scanned)"

if [[ ${#refs[@]} -gt 0 ]]; then
  echo
  echo "== Collapse citations =="
  for slug in "${refs[@]}"; do
    for f in "${files[@]}"; do
      [[ "$(basename "$f")" == "$slug" ]] && continue
      n=$(grep -c -- "$slug" "$f" || true)
      if [[ $n -gt 1 ]]; then
        echo "REPEATED  $f cites $slug ${n}x (expected 1)"
        failed=1
      fi
    done
  done
  [[ $failed -eq 0 ]] && echo "each collapsed file cites its reference at most once"
fi

echo
echo "== Line counts vs $base =="
printf '%-60s %8s %8s %8s\n' FILE BEFORE AFTER DELTA
total_b=0; total_a=0
for f in "${files[@]}"; do
  rel=$(git ls-files --full-name "$f" 2>/dev/null || echo "")
  if [[ -n $rel ]] && git cat-file -e "$base:$rel" 2>/dev/null; then
    before=$(git show "$base:$rel" | wc -l | tr -d ' ')
  else
    before=0
  fi
  after=$(wc -l < "$f" | tr -d ' ')
  total_b=$((total_b + before)); total_a=$((total_a + after))
  printf '%-60s %8s %8s %8s\n' "${f#"$dir"/}" "$before" "$after" "$((after - before))"
done
printf '%-60s %8s %8s %8s\n' TOTAL "$total_b" "$total_a" "$((total_a - total_b))"

echo
[[ $failed -eq 0 ]] && echo "VERIFY PASS" || echo "VERIFY FAIL"
exit $failed
