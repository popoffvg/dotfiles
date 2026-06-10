#!/usr/bin/env bash
# Drive / verify the Platforma backend SSO login flow over gRPC with grpcurl.
#
# The backend's gRPC reflection is auth-gated, so calls use a minimal
# wire-compatible proto (pl-sso-auth.proto, next to this script).
#
# Subcommands:
#   methods                      AuthMethods — show advertised login methods
#   begin                        BeginSSOLogin — print server-issued nonce JSON
#   login  TOKENS_JSON [OUT]     Login with SSOCredentials built from the
#                                tokens file written by the PoC `pnpm oidc-login`
#                                (needs id_token/access_token/refresh_token/expires_in).
#                                Writes Login response JSON to OUT (default:
#                                <TOKENS_JSON>.session.json)
#   session-info SESSION_JSON    GetSessionInfo authenticated with .token from
#                                a Login response file — proves the JWT works
#
# Options (before subcommand):
#   --addr HOST:PORT   backend gRPC address (default 127.0.0.1:6345)
#
# Usage example (full flow):
#   pl-sso-verify.sh begin                    # -> nonce
#   OIDC_NONCE=<nonce> pnpm oidc-login t.json # in poc/code, interactive browser
#   pl-sso-verify.sh login t.json             # -> t.json.session.json
#   pl-sso-verify.sh session-info t.json.session.json

set -o nounset -o errexit -o pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROTO="$SCRIPT_DIR/pl-sso-auth.proto"
ADDR="127.0.0.1:6345"

[ -f "$PROTO" ] || { echo "proto not found: $PROTO" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --addr) ADDR="$2"; shift 2 ;;
    *) break ;;
  esac
done

CMD="${1:-}"; shift || true

gcall() { # gcall <method> [grpcurl-args...] -- stdin = request JSON
  grpcurl -plaintext -import-path "$SCRIPT_DIR" -proto "$(basename "$PROTO")" \
    "${@:2}" -d @ "$ADDR" "MiLaboratories.PL.API.Platform/$1"
}

case "$CMD" in
  methods)
    echo '{}' | gcall AuthMethods
    ;;
  begin)
    echo '{}' | gcall BeginSSOLogin
    ;;
  login)
    TOKENS="${1:?usage: login TOKENS_JSON [OUT_JSON]}"
    OUT="${2:-$TOKENS.session.json}"
    [ -f "$TOKENS" ] || { echo "tokens file not found: $TOKENS" >&2; exit 1; }
    # token_response is `bytes` -> base64 in grpcurl JSON
    TR_B64=$(jq -cj '{id_token, access_token, refresh_token, expires_in}' "$TOKENS" | base64)
    printf '{"sso":{"token_response":"%s"}}' "$TR_B64" | gcall Login | tee "$OUT"
    echo "saved Login response -> $OUT" >&2
    ;;
  session-info)
    SESSION="${1:?usage: session-info SESSION_JSON (Login response with .token)}"
    [ -f "$SESSION" ] || { echo "session file not found: $SESSION" >&2; exit 1; }
    JWT=$(jq -rj '.token' "$SESSION")
    [ -n "$JWT" ] && [ "$JWT" != "null" ] || { echo "no .token in $SESSION" >&2; exit 1; }
    echo '{}' | gcall GetSessionInfo -H "authorization: Bearer $JWT"
    ;;
  *)
    sed -n '2,26p' "$0" >&2
    exit 2
    ;;
esac
