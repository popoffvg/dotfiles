#!/usr/bin/env bash
# Compare `helm template` output for every fixture in a directory between the
# working tree and a control git revision. Answers "did my chart edit change the
# render of anything I did not mean to touch?" byte-for-byte, instead of the
# weaker "does it still render at all".
#
# A fixture that fails to render is compared by its error text, so the negative
# fixtures a chart ships (missing name, duplicate id, no auth) count as matches
# when they keep failing the same way. That matters: those look like breakage in
# a pass/fail sweep and hide real regressions among themselves.
set -euo pipefail

usage() {
  cat <<'USAGE'
usage: helm-render-fixture-diff.sh --chart DIR --fixtures DIR --control REV
                                   [--base FILE] [--repo DIR] [--verbose]

  --chart     chart path, relative to the repo root
  --fixtures  directory of values fixtures, relative to the repo root
  --control   git revision to compare against (e.g. HEAD~1, a sha)
  --base      values file layered under every fixture, relative to the repo root
              (default: <fixtures>/base.yaml when it exists)
  --repo      repo root (default: current directory)
  --mask RE   sed-style regex whose match is blanked on both sides before the
              comparison; repeatable. Use for values that differ on every render
              regardless of the chart source, or the tool reports them as
              changes your edit did not make. A chart that bcrypts inline
              credentials salts them randomly, so `htpasswd:` values differ
              between two renders of one unmodified tree. Masked by default —
              pass --no-default-masks to compare them raw.
  --no-default-masks  drop the built-in masks
  --lint      compare `helm lint` pass/fail per fixture instead of render text.
              Catches a values-schema regression a render comparison can miss,
              because lint validates values against values.schema.json. A
              fixture a chart ships to BE rejected keeps failing on both sides
              and counts as unchanged — only a flipped verdict is reported.
  --verbose   print the render diff for each fixture that differs
USAGE
}

CHART='' FIXTURES='' CONTROL='' BASE='' REPO=$PWD VERBOSE=0
MASKS=() DEFAULT_MASKS=1 MODE=render
while [ $# -gt 0 ]; do
  case "$1" in
    --chart) CHART=$2; shift 2;;
    --fixtures) FIXTURES=$2; shift 2;;
    --control) CONTROL=$2; shift 2;;
    --base) BASE=$2; shift 2;;
    --repo) REPO=$2; shift 2;;
    --mask) MASKS+=("$2"); shift 2;;
    --no-default-masks) DEFAULT_MASKS=0; shift;;
    --lint) MODE=lint; shift;;
    --verbose) VERBOSE=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2;;
  esac
done

[ -n "$CHART" ] && [ -n "$FIXTURES" ] && [ -n "$CONTROL" ] || { usage >&2; exit 2; }
command -v helm >/dev/null || { echo "helm not on PATH" >&2; exit 2; }

cd "$REPO"
[ -d "$FIXTURES" ] || { echo "no such fixtures dir: $FIXTURES" >&2; exit 2; }
if [ -z "$BASE" ] && [ -f "$FIXTURES/base.yaml" ]; then BASE="$FIXTURES/base.yaml"; fi

CONTROL_SHA=$(git rev-parse --verify "$CONTROL") || exit 2
WORKTREE=$(mktemp -d)/control
cleanup() { git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git worktree add -q --detach "$WORKTREE" "$CONTROL_SHA"

if [ "$DEFAULT_MASKS" -eq 1 ]; then
  # bcrypt salts every hash, so an inline-credential chart renders a different
  # htpasswd blob each run from identical source.
  MASKS+=('htpasswd: [A-Za-z0-9+/=]\{16,\}')
fi

mask() {
  if [ ${#MASKS[@]} -eq 0 ]; then cat; return; fi
  local script='' re
  for re in "${MASKS[@]}"; do script="$script;s|$re|<masked>|g"; done
  sed "${script#;}"
}

render() { # <root> <fixture>
  local root=$1 fixture=$2 args=()
  [ -n "$BASE" ] && args+=(--values "$root/$BASE")
  args+=(--values "$root/$fixture")
  if [ "$MODE" = lint ]; then
    # The exit status is the whole observation: a fixture the chart is meant to
    # reject exits non-zero on both sides and reads as unchanged.
    ( cd "$root" && helm lint "$root/$CHART" "${args[@]}" >/dev/null 2>&1 ) && echo "lint: pass" || echo "lint: fail"
    return
  fi
  ( cd "$root" && helm template render-probe "$root/$CHART" "${args[@]}" 2>&1 ) | mask || true
}

echo "control: $CONTROL ($CONTROL_SHA)"
echo "chart:   $CHART"
[ -n "$BASE" ] && echo "base:    $BASE"
echo

same=0 differ=0 names=()
for fixture in "$FIXTURES"/*.yaml "$FIXTURES"/*.yml; do
  [ -f "$fixture" ] || continue
  [ -n "$BASE" ] && [ "$fixture" = "$BASE" ] && continue
  if [ ! -f "$WORKTREE/$fixture" ]; then
    printf 'NEW      %s (absent from control, not compared)\n' "$(basename "$fixture")"
    continue
  fi
  now=$(render "$REPO" "$fixture")
  was=$(render "$WORKTREE" "$fixture")
  if [ "$now" = "$was" ]; then
    same=$((same + 1))
  else
    differ=$((differ + 1)); names+=("$fixture")
    printf 'DIFFERS  %s\n' "$(basename "$fixture")"
    if [ "$VERBOSE" -eq 1 ]; then
      diff <(printf '%s\n' "$was") <(printf '%s\n' "$now") | sed 's/^/         /' || true
    fi
  fi
done

echo
echo "identical=$same differing=$differ"
[ "$differ" -eq 0 ] || { printf 'changed: %s\n' "${names[*]}"; exit 1; }
