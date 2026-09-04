#!/usr/bin/env bash
# Third probe of navikt/mock-oauth2-server: find which tokenCallbacks
# requestMappings form actually fires, so the issued id_token carries the
# sub/email/name claims a Platforma sso provider reads.
# Runs one container per candidate config and prints the decoded claims.
set -uo pipefail

IMAGE="${IMAGE:-ghcr.io/navikt/mock-oauth2-server:2.1.10}"
NAME="probe-mock-oidc-claims"
PORT="${PORT:-18082}"
FWD_HOST="${FWD_HOST:-mock-idp.hz.platforma.bio}"
BASE="http://127.0.0.1:${PORT}/default"
REDIRECT="http://127.0.0.1:45678/callback"

CLAIMS='"sub":"alice@example.test","email":"alice@example.test","email_verified":true,"name":"Alice Probe"'

decode_jwt() {
  local payload
  payload="$(cut -d. -f2)"
  while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="${payload}="; done
  printf '%s' "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null
}

try_config() {
  local label="$1" cfg="$2"

  docker rm -f "$NAME" >/dev/null 2>&1
  docker run -d --name "$NAME" -p "${PORT}:8080" \
    -e LOG_LEVEL=DEBUG -e JSON_CONFIG="$cfg" "$IMAGE" >/dev/null 2>&1 || {
      echo "--- ${label}: RUN FAILED"; return; }

  local up=no
  for _ in $(seq 1 40); do
    curl -sf "${BASE}/.well-known/openid-configuration" >/dev/null && { up=yes; break; }
    sleep 0.5
  done
  [ "$up" = yes ] || { echo "--- ${label}: NEVER CAME UP"; docker logs "$NAME" 2>&1 | tail -5; return; }

  local verifier challenge loc code resp id_token
  verifier="$(openssl rand -base64 48 | tr -d '=+/\n' | cut -c1-64)"
  challenge="$(printf '%s' "$verifier" | openssl dgst -binary -sha256 | openssl base64 | tr '+/' '-_' | tr -d '=\n')"

  loc="$(curl -s -o /dev/null -D - -H "Host: ${FWD_HOST}" -H "X-Forwarded-Proto: https" \
    "${BASE}/authorize?response_type=code&client_id=platforma-mock&redirect_uri=${REDIRECT}&scope=openid%20profile%20email&state=st1&login_hint=alice@example.test&code_challenge=${challenge}&code_challenge_method=S256" \
    | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')"
  code="$(printf '%s' "$loc" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')"
  [ -n "$code" ] || { echo "--- ${label}: NO CODE"; return; }

  resp="$(curl -s -X POST "${BASE}/token" -H "Host: ${FWD_HOST}" -H "X-Forwarded-Proto: https" \
    -d grant_type=authorization_code -d "code=${code}" -d "redirect_uri=${REDIRECT}" \
    -d client_id=platforma-mock -d "code_verifier=${verifier}")"
  id_token="$(printf '%s' "$resp" | sed -n 's/.*"id_token"[^"]*"\([^"]*\)".*/\1/p')"

  printf -- '--- %s\n' "$label"
  if [ -n "$id_token" ]; then
    printf '%s' "$id_token" | decode_jwt; echo
  else
    printf '    NO id_token: %s\n' "$(printf '%s' "$resp" | tr -d '\n' | head -c 200)"
  fi
}

docker pull -q "$IMAGE" >/dev/null || { echo "PULL FAILED"; exit 1; }

try_config "A. no tokenCallbacks at all" \
  '{"interactiveLogin":false}'

try_config "B. requestParam=client_id match=platforma-mock (exact)" \
  "{\"interactiveLogin\":false,\"tokenCallbacks\":[{\"issuerId\":\"default\",\"tokenExpiry\":3600,\"requestMappings\":[{\"requestParam\":\"client_id\",\"match\":\"platforma-mock\",\"claims\":{${CLAIMS}}}]}]}"

try_config "C. requestParam=client_id match=* " \
  "{\"interactiveLogin\":false,\"tokenCallbacks\":[{\"issuerId\":\"default\",\"tokenExpiry\":3600,\"requestMappings\":[{\"requestParam\":\"client_id\",\"match\":\"*\",\"claims\":{${CLAIMS}}}]}]}"

try_config "D. requestParam=grant_type match=authorization_code" \
  "{\"interactiveLogin\":false,\"tokenCallbacks\":[{\"issuerId\":\"default\",\"tokenExpiry\":3600,\"requestMappings\":[{\"requestParam\":\"grant_type\",\"match\":\"authorization_code\",\"claims\":{${CLAIMS}}}]}]}"

try_config "E. D + sub templated from login_hint" \
  "{\"interactiveLogin\":false,\"tokenCallbacks\":[{\"issuerId\":\"default\",\"tokenExpiry\":3600,\"requestMappings\":[{\"requestParam\":\"grant_type\",\"match\":\"authorization_code\",\"claims\":{\"sub\":\"\${login_hint}\",\"email\":\"\${login_hint}\",\"email_verified\":true,\"name\":\"Mock User\"}}]}]}"

docker rm -f "$NAME" >/dev/null 2>&1 && echo "### cleaned up"
