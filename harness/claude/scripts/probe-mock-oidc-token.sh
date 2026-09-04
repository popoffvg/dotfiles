#!/usr/bin/env bash
# Second probe of navikt/mock-oauth2-server: run the full authorization-code
# + PKCE exchange and print the decoded id_token claims, so the claim mapping
# a Platforma sso provider needs (email, sub, name) can be confirmed.
set -uo pipefail

IMAGE="${IMAGE:-ghcr.io/navikt/mock-oauth2-server:2.1.10}"
NAME="probe-mock-oidc-token"
PORT="${PORT:-18081}"
FWD_HOST="${FWD_HOST:-mock-idp.hz.platforma.bio}"
BASE="http://127.0.0.1:${PORT}/default"
REDIRECT="http://127.0.0.1:45678/callback"

# PKCE pair, computed so the verifier always clears the 43-character minimum.
VERIFIER="$(openssl rand -base64 48 | tr -d '=+/\n' | cut -c1-64)"
CHALLENGE="$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr '+/' '-_' | tr -d '=\n')"
echo "### pkce verifier length: ${#VERIFIER}"

docker rm -f "$NAME" >/dev/null 2>&1
docker pull -q "$IMAGE" >/dev/null || { echo "PULL FAILED"; exit 1; }

docker run -d --name "$NAME" -p "${PORT}:8080" \
  -e LOG_LEVEL=DEBUG \
  -e JSON_CONFIG='{"interactiveLogin":false,"tokenCallbacks":[{"issuerId":"default","tokenExpiry":3600,"requestMappings":[{"requestParam":"scope","match":"*","claims":{"sub":"alice@example.test","email":"alice@example.test","email_verified":true,"name":"Alice Probe"}}]}]}' \
  "$IMAGE" >/dev/null || { echo "RUN FAILED"; exit 1; }

for _ in $(seq 1 40); do
  curl -sf "${BASE}/.well-known/openid-configuration" >/dev/null && break
  sleep 0.5
done

decode_jwt() {
  # Print the payload of a JWT read from stdin, base64url-decoded.
  local payload
  payload="$(cut -d. -f2)"
  while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="${payload}="; done
  printf '%s' "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null
}

echo "### authorize -> code"
LOCATION="$(curl -s -o /dev/null -D - \
  -H "Host: ${FWD_HOST}" -H "X-Forwarded-Proto: https" \
  "${BASE}/authorize?response_type=code&client_id=platforma-mock&redirect_uri=${REDIRECT}&scope=openid%20profile%20email&state=st1&code_challenge=${CHALLENGE}&code_challenge_method=S256" \
  | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')"
echo "location: ${LOCATION}"
CODE="$(printf '%s' "$LOCATION" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')"
echo "code: ${CODE:-<none>}"
[ -n "$CODE" ] || { echo "NO CODE -- aborting"; docker logs "$NAME" 2>&1 | tail -20; docker rm -f "$NAME" >/dev/null; exit 1; }

echo
echo "### token exchange (PKCE, no client_secret -- public client)"
RESP="$(curl -s -X POST "${BASE}/token" \
  -H "Host: ${FWD_HOST}" -H "X-Forwarded-Proto: https" \
  -d grant_type=authorization_code \
  -d "code=${CODE}" \
  -d "redirect_uri=${REDIRECT}" \
  -d client_id=platforma-mock \
  -d "code_verifier=${VERIFIER}")"
printf '%s\n' "$RESP" | head -c 600
echo

ID_TOKEN="$(printf '%s' "$RESP" | sed -n 's/.*"id_token"[^"]*"\([^"]*\)".*/\1/p')"
echo
echo "### decoded id_token claims"
if [ -n "$ID_TOKEN" ]; then
  printf '%s' "$ID_TOKEN" | decode_jwt
  echo
else
  echo "NO id_token IN RESPONSE"
fi

echo
echo "### logs"
docker logs "$NAME" 2>&1 | grep -iE 'issuing|token|error|exception' | tail -15

docker rm -f "$NAME" >/dev/null 2>&1 && echo "### cleaned up"
