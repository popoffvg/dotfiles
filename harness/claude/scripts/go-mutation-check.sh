#!/usr/bin/env bash
# go-mutation-check.sh — apply one-line mutants to sandbox copies of Go source, run the covering tests, report survivors.
set -uo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: go-mutation-check.sh [-j N] [-t DURATION] [-n] [-F] <checkout> <mutants-file>

  -j N   run N mutants at a time, each in its own hardlinked sandbox of <checkout>
         (default: half the cores, min 2, max 8)
  -t D   go test -timeout for every run (default 2m); a mutant that hits it is `timeout`, a kill
  -n     skip the coverage pass
  -F     do not append -failfast to go test commands

Each line of <mutants-file> is TAB-separated:
  <label>\t<file>[:<line>]\t<perl-expr>\t<test-command>
The perl expression edits a sandbox copy of <file>. <checkout> is never written.
An edit whose first changed line is not <line> is MISPLACED and runs nothing.

The coverage pass runs each distinct test command once in <checkout>. A mutant on a line the
profile counts only at zero is UNCOVERED and runs nothing. A line the profile lacks always runs.

Progress lines go to stderr as each mutant ends. The sorted verdicts and the tally line
(killed=N timeout=N survived=N ...) go to stdout.

Exit 0 every mutant killed
     1 a mutant survived, was uncovered, no-opped, or was misplaced
     2 bad usage, or the unmutated test command fails
     3 another run over the same files is still going
EOF
  exit 2
}

JOBS=""
TEST_TIMEOUT="2m"
COVERAGE=1
FAILFAST=1

while getopts ":j:t:nF" opt; do
  case "$opt" in
    j) JOBS="$OPTARG" ;;
    t) TEST_TIMEOUT="$OPTARG" ;;
    n) COVERAGE=0 ;;
    F) FAILFAST=0 ;;
    *) usage ;;
  esac
done
shift $((OPTIND - 1))
[ $# -eq 2 ] || usage

CHECKOUT="$(cd "$1" && pwd)" || exit 2
[ -f "$2" ] || { echo "go-mutation-check: no mutants file at $2" >&2; exit 2; }
MUTANTS="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"

if [ -z "$JOBS" ]; then
  cores="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
  JOBS=$((cores / 2))
  [ "$JOBS" -lt 2 ] && JOBS=2
  [ "$JOBS" -gt 8 ] && JOBS=8
fi

RUNDIR="$(mktemp -d "${TMPDIR:-/tmp}/mutcheck.XXXXXX")"
OWN_LOCK=""
trap 'rm -rf "$RUNDIR" ${OWN_LOCK:+"$OWN_LOCK"}' EXIT
trap 'kill $(jobs -p) 2>/dev/null; exit 130' TERM INT HUP

grep -v '^[[:space:]]*$' "$MUTANTS" | grep -v '^#' >"$RUNDIR/all.tsv"
total="$(wc -l <"$RUNDIR/all.tsv" | tr -d ' ')"
[ "$total" -lt 1 ] && { echo "no mutants to run"; exit 0; }
[ "$total" -lt "$JOBS" ] && JOBS="$total"

mutated_files="$(cut -f2 "$RUNDIR/all.tsv" | sed 's/:[0-9]*$//' | sort -u | tr '\n' ' ')"
lock="${TMPDIR:-/tmp}/mutcheck-lock-$(printf '%s %s' "$CHECKOUT" "$mutated_files" | cksum | cut -d' ' -f1)"
if ! mkdir "$lock" 2>/dev/null; then
  holder="$(cat "$lock/pid" 2>/dev/null)"
  if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then
    echo "go-mutation-check: a run over these files is still going (pid $holder). Wait for its tally line, or stop it with: kill $holder" >&2
    exit 3
  fi
  rm -rf "$lock"
  mkdir "$lock" || exit 3
fi
OWN_LOCK="$lock"
echo $$ >"$lock/pid"

with_go_flags() {
  local cmd="$1" flag
  shift
  case "$cmd" in *"go test"*) ;; *) printf '%s' "$cmd"; return ;; esac
  for flag in "$@"; do
    case "$cmd" in *" ${flag%%=*}"*) ;; *) cmd="$cmd $flag" ;; esac
  done
  printf '%s' "$cmd"
}

ends_with_line() {
  awk -v s="$1" 'length($0) >= length(s) && substr($0, length($0) - length(s) + 1) == s { found = 1; exit }
    END { exit !found }' "$2"
}

line_never_runs() {
  local key="/${1#./}:$2"
  [ -n "$2" ] || return 1
  ends_with_line "$key" "$RUNDIR/zero.txt" && ! ends_with_line "$key" "$RUNDIR/covered.txt"
}

first_changed_line() {
  awk 'NR == FNR { original[FNR] = $0; length_original = FNR; next }
    !(FNR in original) || original[FNR] != $0 { print FNR; changed = 1; exit }
    END { if (!changed && FNR < length_original) print FNR + 1 }' "$1" "$2"
}

: >"$RUNDIR/zero.txt"
: >"$RUNDIR/covered.txt"
if [ "$COVERAGE" = 1 ]; then
  cut -f4 "$RUNDIR/all.tsv" | sort -u >"$RUNDIR/commands.txt"
  n=0
  while IFS= read -r testcmd; do
    case "$testcmd" in *"go test"*) ;; *) continue ;; esac
    n=$((n + 1))
    cmd="$(with_go_flags "$testcmd" "-timeout=$TEST_TIMEOUT" -covermode=set "-coverprofile=$RUNDIR/cover$n.out")"
    echo "coverage pass: $cmd" >&2
    if ! (cd "$CHECKOUT" && eval "$cmd") </dev/null >"$RUNDIR/cover$n.log" 2>&1; then
      echo "go-mutation-check: the unmutated test command fails, so every mutant would die for the wrong reason: $testcmd" >&2
      grep -q 'panic: test timed out after' "$RUNDIR/cover$n.log" \
        && echo "go-mutation-check: the unmutated suite is slower than -t $TEST_TIMEOUT; raise -t" >&2
      head -20 "$RUNDIR/cover$n.log" >&2
      exit 2
    fi
  done <"$RUNDIR/commands.txt"
  cat "$RUNDIR"/cover*.out 2>/dev/null | awk -v zero="$RUNDIR/zero.raw" -v covered="$RUNDIR/covered.raw" '
    $1 != "mode:" && NF == 3 {
      split($1, a, ":"); path = a[1]
      split(a[2], r, ","); split(r[1], s, "."); split(r[2], e, ".")
      for (l = s[1]; l <= e[1]; l++) print path ":" l > ($3 > 0 ? covered : zero)
    }'
  [ -f "$RUNDIR/zero.raw" ] && sort -u "$RUNDIR/zero.raw" >"$RUNDIR/zero.txt"
  [ -f "$RUNDIR/covered.raw" ] && sort -u "$RUNDIR/covered.raw" >"$RUNDIR/covered.txt"
  echo "coverage map: $(wc -l <"$RUNDIR/covered.txt" | tr -d ' ') executed lines" >&2
fi

report() {
  echo "$2" >>"$1"
  echo "progress: $2" >&2
}

run_slice() {
  local slice="$1" out="$2" name sandbox log label target expr testcmd file line cmd changed
  name="$(basename "$slice")"
  sandbox="$RUNDIR/sb$name"
  log="$RUNDIR/log$name"
  : >"$out"
  cp -al "$CHECKOUT" "$sandbox" 2>/dev/null || cp -a "$CHECKOUT" "$sandbox" \
    || { echo "go-mutation-check: sandbox copy of $CHECKOUT failed" >&2; return; }
  cd "$sandbox" || return

  while IFS=$'\t' read -r label target expr testcmd; do
    [ -z "${label:-}" ] && continue
    file="${target%%:*}"
    line=""
    case "$target" in *:*) line="${target##*:}" ;; esac

    # perl -i writes a new inode, so the hardlinked file in <checkout> keeps its content.
    cp "$file" "$file.mutbak"
    perl -0pi -e "$expr" "$file"

    if cmp -s "$file" "$file.mutbak"; then
      report "$out" "NO-OP     $label  (expression matched nothing — mutant never applied)"
      mv "$file.mutbak" "$file"
      continue
    fi

    changed="$(first_changed_line "$file.mutbak" "$file")"
    if [ -n "$line" ] && [ "$changed" != "$line" ]; then
      report "$out" "MISPLACED $label  (the edit changed line $changed, not $line — anchor the expression or fix the line)"
      mv "$file.mutbak" "$file"
      continue
    fi

    if line_never_runs "$file" "$line"; then
      report "$out" "UNCOVERED $label  (no test executes $target — nothing could kill it)"
      mv "$file.mutbak" "$file"
      continue
    fi

    cmd="$testcmd"
    [ "$FAILFAST" = 1 ] && cmd="$(with_go_flags "$cmd" -failfast)"
    cmd="$(with_go_flags "$cmd" "-timeout=$TEST_TIMEOUT")"

    if eval "$cmd" </dev/null >"$log" 2>&1; then
      report "$out" "SURVIVED  $label"
    elif grep -q 'panic: test timed out after' "$log"; then
      report "$out" "timeout   $label  (the test hit -t $TEST_TIMEOUT — the mutant made it hang)"
    elif grep -q '\[build failed\]' "$log"; then
      report "$out" "invalid   $label  (the mutant does not compile)"
    else
      report "$out" "killed    $label"
    fi

    mv "$file.mutbak" "$file"
  done <"$slice"
}

awk -v n="$JOBS" -v d="$RUNDIR" '{ print > (d "/slice" (NR % n)) }' "$RUNDIR/all.tsv"

echo "running $total mutants over $JOBS parallel sandboxes" >&2
for i in $(seq 0 $((JOBS - 1))); do
  [ -f "$RUNDIR/slice$i" ] || continue
  run_slice "$RUNDIR/slice$i" "$RUNDIR/out$i" &
done
wait

cat "$RUNDIR"/out* 2>/dev/null | sort >"$RUNDIR/verdicts.txt"
cat "$RUNDIR/verdicts.txt"

count() { grep -c "^$1" "$RUNDIR/verdicts.txt"; }
survived=$(count SURVIVED)
uncovered=$(count UNCOVERED)
noop=$(count NO-OP)
misplaced=$(count MISPLACED)

echo
echo "killed=$(count killed) timeout=$(count timeout) survived=$survived uncovered=$uncovered no-op=$noop misplaced=$misplaced invalid=$(count invalid)"
[ "$survived" -eq 0 ] && [ "$uncovered" -eq 0 ] && [ "$noop" -eq 0 ] && [ "$misplaced" -eq 0 ]
