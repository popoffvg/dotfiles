#!/usr/bin/env bash
# Index one or more repos with GitNexus (embeddings + PDG), sequentially.
# Usage: gitnexus-index-repos.sh [--flags "..."] <repo-dir> [<repo-dir> ...]
set -uo pipefail

export DYLD_FALLBACK_LIBRARY_PATH="/opt/nanobrew/prefix/opt/openssl@3/lib:/usr/local/lib:/usr/lib${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"

FLAGS="--embeddings --pdg"
if [ "${1:-}" = "--flags" ]; then
  FLAGS="$2"
  shift 2
fi

if [ $# -eq 0 ]; then
  echo "usage: $0 [--flags \"...\"] <repo-dir> [<repo-dir> ...]" >&2
  exit 2
fi

LOG_DIR="${GITNEXUS_LOG_DIR:-$HOME/.gitnexus/logs}"
mkdir -p "$LOG_DIR"

failed=()
for repo in "$@"; do
  if [ ! -e "$repo/.git" ]; then
    echo "SKIP  $repo (not a git repo)"
    continue
  fi
  name=$(basename "$repo")
  log="$LOG_DIR/$name.log"
  echo "INDEX $repo -> $log"
  start=$SECONDS
  if (cd "$repo" && gitnexus analyze $FLAGS) >"$log" 2>&1; then
    echo "OK    $name ($((SECONDS - start))s)"
  elif grep -q "without persisted embeddings" "$log"; then
    # Nothing embeddable in this repo — analyze refuses to register a zero-vector
    # index. Retry with embeddings off so the graph still gets built.
    noemb=${FLAGS//--embeddings 0/}
    noemb=${noemb//--embeddings/}
    if (cd "$repo" && gitnexus analyze $noemb) >"$log" 2>&1; then
      echo "OK    $name ($((SECONDS - start))s, no embeddings)"
    else
      echo "FAIL  $name ($((SECONDS - start))s) — see $log"
      tail -15 "$log" | sed 's/^/      /'
      failed+=("$name")
    fi
  else
    echo "FAIL  $name ($((SECONDS - start))s) — see $log"
    tail -15 "$log" | sed 's/^/      /'
    failed+=("$name")
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed: ${failed[*]}"
  exit 1
fi
echo "All repos indexed."
