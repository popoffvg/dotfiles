#!/usr/bin/env bash
# Build and run the platforma workflow-tengo suite against a local pl backend,
# capturing FULL output. Usage: wf-tengo-suite.sh <git-ref> <out-file> [worktree]
set -uo pipefail

REF="${1:?git ref required}"
OUT="${2:?output file required}"
WT="${3:-/tmp/claude/ptabler-scoped}"

export NODE_AUTH_TOKEN="${NODE_AUTH_TOKEN:-${NPMJS_TOKEN:-}}"
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-$HOME/.config/ssl/combined-certs.pem}"
export PL_ADDRESS="${PL_ADDRESS:-http://127.0.0.1:16345}"
export PL_TEST_USER="${PL_TEST_USER:-test-user}"
export PL_TEST_PASSWORD="${PL_TEST_PASSWORD:-test-password}"

cd "$WT" || exit 1

{
  echo "### ref=$REF started=$(date -u +%FT%TZ)"
  git checkout -q "$REF" || { echo "CHECKOUT FAILED"; exit 1; }
  echo "### head=$(git log --oneline -1)"

  echo "### BUILD"
  pnpm turbo run build --filter=@platforma-sdk/workflow-tengo-tests... 2>&1 | tail -6
  echo "### build_exit=${PIPESTATUS[0]}"

  echo "### TEST"
  cd tests/workflow-tengo || exit 1
  npx vitest run --reporter=dot 2>&1
  echo "### test_exit=$?"
  echo "### finished=$(date -u +%FT%TZ)"
} > "$OUT" 2>&1
