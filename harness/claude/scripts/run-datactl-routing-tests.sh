#!/usr/bin/env bash
# Run datactl routing/federation tests for the blobroute refactor.
# Usage: run-datactl-routing-tests.sh <repo-dir> <logfile>
set -euo pipefail
REPO="${1:?repo dir required}"
LOG="${2:?logfile required}"
cd "$REPO"
mkdir -p "$(dirname "$LOG")"
/usr/local/go/bin/go test -count=1 \
  -run 'Federation|Federative|TransferHash|Transitive' \
  ./controllers/datactl/internal/test/ > "$LOG" 2>&1
echo "go-test-exit:$?"
