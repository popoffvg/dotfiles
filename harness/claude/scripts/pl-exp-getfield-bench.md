---
name: pl-exp-getfield-bench.sh
description: Run the pl GetField queue experiment for every exp-<variant> worktree and measure size in parallel, building the 20,000-GetField history once into a saved RocksDB that each case clones.
args: "env OUT=DIR [VARIANTS=...] [SIZES=...] [EXP_HISTORY=N] [HISTORY_VARIANT=baseline] [HISTORY_CACHE=DIR] [ROOT=DIR] [TEST_SRC=FILE]"
needs: go, python3, git, APFS cp -c (falls back to cp -R)
used_by: app-hz-getfield-backlog research (.notes/research/app-hz-getfield-backlog)
---
