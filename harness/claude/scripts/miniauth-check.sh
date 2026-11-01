#!/usr/bin/env bash
# Run lint, vet, gosec, and the integration tests of a miniauth worktree.
# Docker uses a config with no credential helper, so testcontainers can build images.
set -uo pipefail
dir="${1:-.}"
cd "$dir" || exit 2
cfg="${MINIAUTH_DOCKER_CONFIG:-${TMPDIR:-/tmp}/miniauth-dockercfg}"
mkdir -p "$cfg"
printf '{"currentContext":"%s"}\n' "$(docker context show)" > "$cfg/config.json"
ln -sfn "$HOME/.docker/contexts" "$cfg/contexts"
ln -sfn "$HOME/.docker/cli-plugins" "$cfg/cli-plugins"
export GOROOT= DOCKER_CONFIG="$cfg"
# One check at a time: every compose project binds port 5432.
lock=/private/tmp/claude-501/miniauth-check.lock
until mkdir "$lock" 2>/dev/null; do sleep 5; done
trap 'rmdir "$lock"' EXIT
mise trust -q . >/dev/null 2>&1
task lint && task vet && task sec || { echo "CHECK: LINT FAILED"; exit 1; }
task test:integration 2>&1 | grep -vE '🐳|✅|🚫|🔔|⏳'
status=${PIPESTATUS[0]}
# Each worktree is its own compose project, and every one binds port 5432.
docker compose down -v >/dev/null 2>&1
if [ "$status" -ne 0 ]; then echo "CHECK: TEST FAILED"; exit 1; fi
echo "CHECK: PASS"
