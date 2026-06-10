#!/usr/bin/env bash
# Run the Platforma backend (pl) with the SSO/OIDC auth method enabled,
# pointed at the Logto PoC tenant (work/projects/sso-and-access-control/poc).
#
# Usage:
#   run-pl-backend-sso.sh [--pl-dir DIR] [--root DIR] [--go-run] [--stub] [-- EXTRA_ARGS...]
#
#   --pl-dir DIR   pl checkout to run from
#                  (default: /Users/popoffvg/Documents/git/mil/tasks/MILAB-6342-oidc-client/pl)
#   --root DIR     backend main root / data dir (default: $HOME/mypl/oidc-dev)
#   --go-run       use `go run ./cmd/platforma` instead of the built binary
#   --stub         use the stub SSO method (--enable-stub-sso-integration,
#                  hardcoded Logto values, accepts any token) instead of the
#                  real --sso-idp-* flags
#   -- ...         everything after `--` is passed through to platforma
#
# Logto tenant values can be overridden via env:
#   PL_SSO_ISSUER, PL_SSO_CLIENT_ID, PL_SSO_SCOPES, PL_SSO_RESOURCE,
#   PL_SSO_REDIRECT_PORT, PL_SSO_USER_ID_CLAIM, PL_SSO_GROUPS_CLAIM
#
# Defaults come from:
#   mil-text/work/projects/sso-and-access-control/poc/logto-config.md
#   pl platform/auth/sso.go (stub constants)

set -o nounset -o errexit -o pipefail

PL_DIR="${PL_DIR:-/Users/popoffvg/Documents/git/mil/tasks/MILAB-6342-oidc-client/pl}"
MAIN_ROOT="${MAIN_ROOT:-$HOME/mypl/oidc-dev}"
LICENSE_FILE="${LICENSE_FILE:-$HOME/.pl.license}"
USE_GO_RUN=0
USE_STUB=0
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --pl-dir) PL_DIR="$2"; shift 2 ;;
    --root)   MAIN_ROOT="$2"; shift 2 ;;
    --go-run) USE_GO_RUN=1; shift ;;
    --stub)   USE_STUB=1; shift ;;
    --)       shift; EXTRA_ARGS=("$@"); break ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# --- Logto PoC tenant (override via env) -----------------------------------
SSO_ISSUER="${PL_SSO_ISSUER:-https://sab7zh.logto.app/oidc}"
SSO_CLIENT_ID="${PL_SSO_CLIENT_ID:-ld69k866zvhnhz3xr1xwd}"
# `read` keeps offline_access alive when the token is bound to the API
# resource (Logto quirk — see poc/code/src/config.ts).
SSO_SCOPES="${PL_SSO_SCOPES:-openid profile email offline_access read urn:logto:scope:organizations urn:logto:scope:organization_roles}"
SSO_RESOURCE="${PL_SSO_RESOURCE:-https://platforma-poc.api/}"
SSO_REDIRECT_PORT="${PL_SSO_REDIRECT_PORT:-8765}"
# Custom claims exist only in the ACCESS token (Logto limitation), hence
# subject-token-source=access_token and the platforma.bio claim names.
SSO_USER_ID_CLAIM="${PL_SSO_USER_ID_CLAIM:-https://platforma.bio/user_id}"
SSO_GROUPS_CLAIM="${PL_SSO_GROUPS_CLAIM:-https://platforma.bio/group_ids}"

# --- sanity checks ----------------------------------------------------------
[ -d "$PL_DIR/cmd/platforma" ] || { echo "not a pl checkout: $PL_DIR" >&2; exit 1; }
[ -f "$LICENSE_FILE" ] || { echo "license file missing: $LICENSE_FILE" >&2; exit 1; }
mkdir -p "$MAIN_ROOT"

# --- choose runner ----------------------------------------------------------
BIN="$PL_DIR/cmd/platforma/platforma"   # build.sh runs `go build` in cmd/platforma
if [ "$USE_GO_RUN" -eq 1 ] || [ ! -x "$BIN" ]; then
  RUNNER=(go run ./cmd/platforma)
  [ ! -x "$BIN" ] && echo "note: built binary not found at $BIN — using 'go run'" >&2
else
  RUNNER=("$BIN")
fi

# --- assemble args ----------------------------------------------------------
ARGS=(
  --license-file "$LICENSE_FILE"
  --main-root "$MAIN_ROOT/data"
  # no --primary-storage-s3/gcs => FS primary storage under main-root
  --auth-sessions-gen dev1          # persistent sessions across restarts
  --debug-enabled --debug-port=9091
)

if [ "$USE_STUB" -eq 1 ]; then
  ARGS+=( --enable-stub-sso-integration )
else
  ARGS+=(
    --sso-idp-issuer "$SSO_ISSUER"
    --sso-idp-client-id "$SSO_CLIENT_ID"
    --sso-idp-scopes "$SSO_SCOPES"
    --sso-idp-resource "$SSO_RESOURCE"
    --sso-idp-redirect-port "$SSO_REDIRECT_PORT"
    --sso-idp-user-id-claim "$SSO_USER_ID_CLAIM"
    --sso-idp-groups-claim "$SSO_GROUPS_CLAIM"
    --sso-idp-subject-token-source access_token
    --sso-idp-prompt consent        # Logto needs consent for offline_access
  )
fi

ARGS+=("${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}")

echo "pl checkout : $PL_DIR" >&2
echo "main root   : $MAIN_ROOT" >&2
echo "mode        : $([ "$USE_STUB" -eq 1 ] && echo stub || echo real-sso)" >&2
echo "command     : ${RUNNER[*]} ${ARGS[*]}" >&2

cd "$PL_DIR"
exec "${RUNNER[@]}" "${ARGS[@]}"
