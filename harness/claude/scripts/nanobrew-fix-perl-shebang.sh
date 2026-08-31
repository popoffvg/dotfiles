#!/usr/bin/env bash
# Repoint nanobrew's perl scripts at a perl that actually runs. The perl bottle
# ships its shebang as the unexpanded token `#!@@HOMEBREW_PERL@@`, so shasum,
# prove, json_pp and friends die with "bad interpreter"; the bottled perl itself
# also carries an @INC pointing at a /opt/homebrew that does not exist here, so
# it cannot load even `strict`. Both count as broken and both get rewritten.
# Re-run after every nanobrew perl upgrade.
set -euo pipefail

PLACEHOLDER='@@HOMEBREW_PERL@@'

# A perl whose @INC is wrong still runs `perl -pi` fine but fails every real
# script, so the test has to load a core module rather than just execute.
perl_runs() {
  [[ -n "$1" && -x "$1" ]] && "$1" -e 'use strict; 1' >/dev/null 2>&1
}

pick_perl() {
  local candidate
  for candidate in "${PERL_BIN:-}" "$(command -v perl || true)" /usr/bin/perl; do
    perl_runs "$candidate" && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

if ! shebang_perl=$(pick_perl); then
  echo "nanobrew-fix-perl-shebang: found no working perl; set PERL_BIN" >&2
  exit 1
fi

default_dir=$(dirname "$(readlink -f "$(command -v perl)" 2>/dev/null || echo /usr/bin/perl)")
target_dir="${1:-$default_dir}"
if [[ ! -d "$target_dir" ]]; then
  echo "nanobrew-fix-perl-shebang: no such directory: $target_dir" >&2
  exit 1
fi

declare -A interpreter_ok=()

needs_fix() {
  local interpreter=$1
  [[ "$interpreter" == "$PLACEHOLDER" ]] && return 0
  [[ "$interpreter" == *perl* ]] || return 1
  if [[ -z "${interpreter_ok[$interpreter]:-}" ]]; then
    interpreter_ok[$interpreter]=$(perl_runs "$interpreter" && echo yes || echo no)
  fi
  [[ "${interpreter_ok[$interpreter]}" == no ]]
}

fixed=0
for script in "$target_dir"/*; do
  [[ -f "$script" && -r "$script" ]] || continue
  first=$(head -1 "$script" 2>/dev/null) || continue
  [[ "$first" == '#!'* ]] || continue

  interpreter=${first#\#!}
  interpreter=${interpreter%% *}
  needs_fix "$interpreter" || continue

  # Via the environment: interpolated into -e, the placeholder's @@ would read
  # as an empty perl array and the pattern would silently never match.
  OLD="$interpreter" SHEBANG="#!$shebang_perl" \
    perl -pi -e 's{^\#\!\Q$ENV{OLD}\E}{$ENV{SHEBANG}}' "$script"
  [[ "$(head -1 "$script")" == "#!$shebang_perl"* ]] || {
    echo "nanobrew-fix-perl-shebang: rewrite did not stick: $script" >&2
    exit 1
  }
  echo "fixed $script"
  fixed=$((fixed + 1))
done

echo "nanobrew-fix-perl-shebang: $fixed script(s) repointed at $shebang_perl"
