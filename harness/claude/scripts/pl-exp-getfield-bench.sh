#!/usr/bin/env bash
# Run the pl GetField queue experiment (TestExperimentGetFieldQueue) for every variant worktree and
# every measure size in parallel. The history step runs once, into a saved RocksDB; each case
# measures on its own clone of it.
#
# Env:
#   OUT              output dir for binaries, logs, <variant>-<size>.json, summary.csv, queue.csv (required)
#   VARIANTS         worktree suffixes under $ROOT/exp-<variant> (default: baseline)
#   SIZES            measure sizes (default: 2000 4000 8000)
#   EXP_HISTORY      history GetFields (default: 20000)
#   HISTORY_VARIANT  worktree that builds the saved history (default: baseline)
#   HISTORY_CACHE    dir of saved histories, one per base commit and size (default: ~/.cache/pl-exp-getfield)
#   ROOT             dir of the exp-<variant> worktrees (default: ~/git/mil/pl/.worktrees)
#   TEST_SRC         the test file copied into every worktree before the build
set -euo pipefail

ROOT=${ROOT:-$HOME/git/mil/pl/.worktrees}
TEST_SRC=${TEST_SRC:-$HOME/git/mil/pl/.notes/research/app-hz-getfield-backlog/proof-tests/exp_getfield_queue_test.go}
OUT=${OUT:?set OUT}
VARIANTS=${VARIANTS:-baseline}
SIZES=${SIZES:-2000 4000 8000}
EXP_HISTORY=${EXP_HISTORY:-20000}
HISTORY_VARIANT=${HISTORY_VARIANT:-baseline}
HISTORY_CACHE=${HISTORY_CACHE:-$HOME/.cache/pl-exp-getfield}
TEST_DIR=platform/core/coretest

mkdir -p "$OUT" "$HISTORY_CACHE"

clone_dir() { cp -cR "$1" "$2" 2>/dev/null || cp -R "$1" "$2"; }

build_variant() {
  local v=$1
  [ -d "$ROOT/exp-$v" ] || { echo "no worktree $ROOT/exp-$v" >&2; exit 1; }
  cp "$TEST_SRC" "$ROOT/exp-$v/$TEST_DIR/"
  (cd "$ROOT/exp-$v" && go test -c -o "$OUT/$v.test" "./$TEST_DIR/")
}

run_case() {
  local v=$1 n=$2 phase=$3 db=$4 log=$5
  local tmp="$OUT/tmp-$v-$n"
  mkdir -p "$tmp"
  (cd "$ROOT/exp-$v/$TEST_DIR" && TMPDIR="$tmp" PL_EXP_GETFIELD=1 EXP_PHASE="$phase" EXP_DB_DIR="$db" \
    EXP_HISTORY="$EXP_HISTORY" EXP_MEASURE="$n" EXP_OUT="$OUT/$v-$n.json" \
    "$OUT/$v.test" -test.run TestExperimentGetFieldQueue -test.count=1 -test.v -test.timeout 90m >"$log" 2>&1)
}

base=$(git -C "$ROOT/exp-$HISTORY_VARIANT" rev-parse --short HEAD)
for v in $VARIANTS; do
  vb=$(git -C "$ROOT/exp-$v" rev-parse --short HEAD)
  [ "$vb" = "$base" ] || echo "warning: exp-$v is on $vb, the saved history comes from $base" >&2
done

build_variant "$HISTORY_VARIANT"
for v in $VARIANTS; do [ "$v" = "$HISTORY_VARIANT" ] || build_variant "$v"; done

history_db="$HISTORY_CACHE/history-$EXP_HISTORY-$base"
if [ ! -d "$history_db" ]; then
  echo "== build history $EXP_HISTORY on $base $(date +%T)"
  rm -rf "$history_db.partial"
  run_case "$HISTORY_VARIANT" history history "$history_db.partial" "$OUT/history.log" \
    || { echo "history build failed, see $OUT/history.log" >&2; exit 1; }
  mv "$history_db.partial" "$history_db"
fi
echo "== saved history $history_db"

for v in $VARIANTS; do
  for n in $SIZES; do
    db="$OUT/db-$v-$n"
    rm -rf "$db"
    clone_dir "$history_db" "$db"
    (run_case "$v" "$n" measure "$db" "$OUT/$v-$n.log"; echo "== $v $n exit $? $(date +%T)"; rm -rf "$db") &
  done
done
wait

python3 - "$OUT" $VARIANTS -- $SIZES <<'PY'
import csv, json, os, sys
out = sys.argv[1]
sep = sys.argv.index("--")
variants, sizes = sys.argv[2:sep], sys.argv[sep + 1:]
with open(os.path.join(out, "summary.csv"), "w", newline="") as fs, \
     open(os.path.join(out, "queue.csv"), "w", newline="") as fq:
    s, q = csv.writer(fs), csv.writer(fq)
    s.writerow(["variant", "get_fields", "create_sync_ms", "resolve_ms", "per_get_field_us", "total_ms",
                "skips_per_seek", "seek_us_avg", "seeks", "skips", "peak_largest_queue", "history_phase"])
    q.writerow(["variant", "get_fields", "at_ms", "total_live", "largest_queue", "non_empty_queues"])
    for v in variants:
        for n in sizes:
            path = os.path.join(out, f"{v}-{n}.json")
            if not os.path.exists(path):
                s.writerow([v, n, "missing"])
                continue
            r = json.load(open(path))
            d = r["rocks_delta"]
            s.writerow([v, r["get_fields"], r["create_sync_ms"], r["resolve_ms"], round(r["per_get_field_us"]),
                        r["create_sync_ms"] + r["resolve_ms"], round(d.get("skips_per_seek", 0), 1),
                        round(d.get("seek_us_avg", 0), 1), int(d.get("number.db.seek", 0)),
                        int(d.get("number.iter.skip", 0)), r["peak_largest_queue"], r.get("history_phase", "")])
            for x in r["samples"] or []:
                q.writerow([v, r["get_fields"], x["at_ms"], x["total_live"], x["largest_queue"], x["non_empty_queues"]])
PY
echo "== done $(date +%T) summary $OUT/summary.csv"
