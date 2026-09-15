#!/usr/bin/env bash
# Test whether Platforma's per-command python env composition breaks venv site-packages.
#
# Platforma sets, for every python exec:
#   PYTHONHOME  = <interpreter package>          (NOT the venv)
#   PYTHONPATH  = <interpreter>/bin/python_stdlib : <software package dir>
#   VIRTUAL_ENV = <venv>
#   PATH        = <venv>/bin : ...
#
# PYTHONHOME overrides sys.prefix, which is what normally makes a venv's
# site-packages importable. If that composition is broken, a correctly bound
# command still fails to import its declared dependency — which would mean the
# "wrong virtualenv" framing of MILAB-6908 is wrong.
#
# Builds a throwaway venv, installs a marker package into it, then runs the
# interpreter under each env combination and reports which ones can import it.
#
# Usage: test-venv-env-composition.sh [workdir]
set -euo pipefail

WORK="${1:-$(mktemp -d)}"
mkdir -p "$WORK"
VENV="$WORK/venv"

BASE_PY="$(command -v python3)"
BASE_PREFIX="$("$BASE_PY" -c 'import sys; print(sys.base_prefix)')"
STDLIB="$("$BASE_PY" -c 'import sysconfig; print(sysconfig.get_paths()["stdlib"])')"

echo "base python : $BASE_PY"
echo "base prefix : $BASE_PREFIX"
echo "stdlib      : $STDLIB"
echo

"$BASE_PY" -m venv "$VENV"

# Marker module standing in for numpy: present ONLY in the venv's site-packages.
SITE="$("$VENV/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
echo 'VALUE = "imported-from-venv"' > "$SITE/venvmarker.py"
echo "marker in   : $SITE/venvmarker.py"
echo

PKGDIR="$WORK/pkg"
mkdir -p "$PKGDIR"

probe='import sys
try:
    import venvmarker
    print("  IMPORT OK   prefix=%s" % sys.prefix)
except ModuleNotFoundError as e:
    print("  IMPORT FAIL %s | prefix=%s" % (e, sys.prefix))'

run_case() {
    echo "$1"
    shift
    env -i PATH="$VENV/bin:/usr/bin:/bin" "$@" python -c "$probe" 2>&1 | sed 's/^/  /' | head -4
    echo
}

echo "=== control: venv on PATH, no Platforma env vars (must IMPORT OK) ==="
run_case ""

echo "=== Platforma composition: PYTHONHOME + PYTHONPATH + VIRTUAL_ENV ==="
run_case "" \
    PYTHONHOME="$BASE_PREFIX" \
    PYTHONPATH="$STDLIB:$PKGDIR" \
    VIRTUAL_ENV="$VENV"

echo "=== PYTHONHOME alone ==="
run_case "" PYTHONHOME="$BASE_PREFIX"

echo "=== PYTHONPATH + VIRTUAL_ENV, no PYTHONHOME ==="
run_case "" PYTHONPATH="$STDLIB:$PKGDIR" VIRTUAL_ENV="$VENV"

echo "workdir kept at: $WORK"
