#!/usr/bin/env bash
# go-mutation-check.sh — apply one-line mutants to Go source, run covering tests, report survivors.
#
# Usage: go-mutation-check.sh [-j N] [-C <go-test-target>] [-F] <worktree> <mutants-file>
#
#   -j N   run N mutants at a time, each in its own hardlinked sandbox of <worktree>
#          (default: half the cores, min 2, max 8)
#   -C T   build a coverage map once from `go test -covermode=set -coverpkg=./... T`
#          (default target ./...); a mutant on an uncovered line is reported without
#          running its tests at all. Pass -C '' to skip the coverage pass.
#   -F     do not append -failfast to `go test` commands
#
# Each line of <mutants-file> is TAB-separated:
#   <label>\t<file>[:<line>]\t<perl-expr>\t<test-command>
# The perl expression is applied in-place to <file>; the file is restored after each run.
# A mutant is KILLED when the test command fails, SURVIVED when it passes.
set -uo pipefail

JOBS=""
COVER_TARGET="./..."
FAILFAST=1

while getopts ":j:C:F" opt; do
  case "$opt" in
    j) JOBS="$OPTARG" ;;
    C) COVER_TARGET="$OPTARG" ;;
    F) FAILFAST=0 ;;
    *) echo "usage: go-mutation-check.sh [-j N] [-C target] [-F] <worktree> <mutants-file>" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

WORKTREE="${1:?usage: go-mutation-check.sh [-j N] [-C target] [-F] <worktree> <mutants-file>}"
MUTANTS="${2:?usage: go-mutation-check.sh [-j N] [-C target] [-F] <worktree> <mutants-file>}"

WORKTREE="$(cd "$WORKTREE" && pwd)" || exit 1
MUTANTS="$(cd "$(dirname "$MUTANTS")" && pwd)/$(basename "$MUTANTS")"

if [ -z "$JOBS" ]; then
  cores="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
  JOBS=$((cores / 2))
  [ "$JOBS" -lt 2 ] && JOBS=2
  [ "$JOBS" -gt 8 ] && JOBS=8
fi

RUNDIR="$(mktemp -d "${TMPDIR:-/tmp}/mutcheck.XXXXXX")"
trap 'rm -rf "$RUNDIR"' EXIT

# ---------------------------------------------------------------- coverage map
# COVERED holds "<file>:<line>" for every line the suite executes at least once.
COVERAGE="$RUNDIR/cover.out"
COVERED_LINES="$RUNDIR/covered.txt"
: >"$COVERED_LINES"
HAVE_COVERAGE=0

if [ -n "$COVER_TARGET" ]; then
  echo "coverage pass: go test -covermode=set -coverpkg=./... $COVER_TARGET" >&2
  if (cd "$WORKTREE" && go test -covermode=set -coverpkg=./... -coverprofile="$COVERAGE" $COVER_TARGET) >/dev/null 2>&1 \
     && [ -s "$COVERAGE" ]; then
    # profile line: <import/path>/<file>:<startLine>.<col>,<endLine>.<col> <stmts> <count>
    awk 'NR>1 {
      split($1, a, ":"); path = a[1]
      split(a[2], r, ",")
      split(r[1], s, "."); split(r[2], e, ".")
      if ($3 > 0) for (l = s[1]; l <= e[1]; l++) print path ":" l
    }' "$COVERAGE" | sort -u >"$COVERED_LINES"
    HAVE_COVERAGE=1
    echo "coverage map: $(wc -l <"$COVERED_LINES" | tr -d ' ') executed lines" >&2
  else
    echo "coverage pass failed — every mutant will run its tests" >&2
  fi
fi

export COVERED_LINES HAVE_COVERAGE FAILFAST WORKTREE

# ------------------------------------------------------------------ the worker
# Each worker owns one hardlinked sandbox and runs its own slice of the mutants
# serially inside it. perl -i replaces the inode, so a mutant never reaches the
# original worktree or another worker's copy.
run_slice() {
  slice="$1"; out="$2"
  sandbox="$RUNDIR/sb$(basename "$slice")"
  cp -al "$WORKTREE" "$sandbox" 2>/dev/null || cp -a "$WORKTREE" "$sandbox" || { echo "sandbox failed" >"$out"; return; }
  cd "$sandbox" || return

  : >"$out"
  while IFS=$'\t' read -r label target expr testcmd; do
    [ -z "${label:-}" ] && continue
    case "$label" in \#*) continue ;; esac

    file="${target%%:*}"
    line=""
    case "$target" in *:*) line="${target##*:}" ;; esac

    if [ "$HAVE_COVERAGE" = 1 ] && [ -n "$line" ] \
       && ! grep -qF -- "/${file#./}:$line" "$COVERED_LINES"; then
      echo "UNCOVERED $label  (no test executes $target — nothing could kill it)" >>"$out"
      continue
    fi

    cp "$file" "$file.mutbak"
    perl -0pi -e "$expr" "$file"

    if cmp -s "$file" "$file.mutbak"; then
      echo "NO-OP     $label  (expression matched nothing — mutant never applied)" >>"$out"
      mv "$file.mutbak" "$file"
      continue
    fi

    cmd="$testcmd"
    if [ "$FAILFAST" = 1 ]; then
      case "$cmd" in
        *"go test"*) case "$cmd" in *-failfast*) ;; *) cmd="$cmd -failfast" ;; esac ;;
      esac
    fi

    if eval "$cmd" >/dev/null 2>&1; then
      echo "SURVIVED  $label" >>"$out"
    else
      echo "killed    $label" >>"$out"
    fi

    mv "$file.mutbak" "$file"
  done <"$slice"
}

# ------------------------------------------------------------- split and spawn
grep -v '^[[:space:]]*$' "$MUTANTS" | grep -v '^#' >"$RUNDIR/all.tsv"
total="$(wc -l <"$RUNDIR/all.tsv" | tr -d ' ')"
[ "$total" -lt "$JOBS" ] && JOBS="$total"
[ "${JOBS:-0}" -lt 1 ] && { echo "no mutants to run"; exit 0; }

awk -v n="$JOBS" -v d="$RUNDIR" '{ print > (d "/slice" (NR % n)) }' "$RUNDIR/all.tsv"

echo "running $total mutants over $JOBS parallel sandboxes" >&2
for i in $(seq 0 $((JOBS - 1))); do
  [ -f "$RUNDIR/slice$i" ] || continue
  run_slice "$RUNDIR/slice$i" "$RUNDIR/out$i" &
done
wait

# -------------------------------------------------------------------- the tally
cat "$RUNDIR"/out* 2>/dev/null | sort

killed=$(cat "$RUNDIR"/out* 2>/dev/null | grep -c '^killed')
survived=$(cat "$RUNDIR"/out* 2>/dev/null | grep -c '^SURVIVED')
uncovered=$(cat "$RUNDIR"/out* 2>/dev/null | grep -c '^UNCOVERED')
noop=$(cat "$RUNDIR"/out* 2>/dev/null | grep -c '^NO-OP')

echo
echo "killed=$killed survived=$survived uncovered=$uncovered no-op=$noop"
[ "$survived" -eq 0 ] && [ "$uncovered" -eq 0 ] && [ "$noop" -eq 0 ]
