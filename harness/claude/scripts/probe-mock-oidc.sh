#!/usr/bin/env bash
# Probe navikt/mock-oauth2-server: what issuer scheme it advertises behind a
# TLS-terminating proxy, and whether interactiveLogin=false auto-redirects
# with an authorization code. Prints findings; leaves no container behind.
set -uo pipefail

IMAGE="${IMAGE:-ghcr.io/navikt/mock-oauth2-server:2.1.10}"
NAME="probe-mock-oidc"
PORT="${PORT:-18080}"
FWD_HOST="${FWD_HOST:-mock-idp.hz.platforma.bio}"
BASE="http://127.0.0.1:${PORT}/default"
DISCOVERY="${BASE}/.well-known/openid-configuration"

docker rm -f "$NAME" >/dev/null 2>&1

echo "### pulling $IMAGE"
docker pull -q "$IMAGE" || { echo "PULL FAILED"; exit 1; }

echo "### manifest platforms"
docker manifest inspect "$IMAGE" 2>/dev/null \
  | grep -oE '"architecture": *"[a-z0-9]+"' | sort -u

docker run -d --name "$NAME" -p "${PORT}:8080" \
  -e LOG_LEVEL=DEBUG \
  -e JSON_CONFIG='{"interactiveLogin":false,"tokenCallbacks":[{"issuerId":"default","tokenExpiry":3600,"requestMappings":[{"requestParam":"client_id","match":"*","claims":{"sub":"alice@example.test","email":"alice@example.test","email_verified":true,"name":"Alice Probe"}}]}]}' \
  "$IMAGE" >/dev/null || { echo "RUN FAILED"; exit 1; }

for _ in $(seq 1 40); do
  curl -sf "$DISCOVERY" >/dev/null && break
  sleep 0.5
done

show_endpoints() {
  tr ',' '\n' | grep -E '"(issuer|authorization_endpoint|token_endpoint|jwks_uri)"'
}

echo
echo "### 1. discovery, plain Host"
curl -s "$DISCOVERY" | show_endpoints

echo
echo "### 2. discovery, X-Forwarded-Proto: https + X-Forwarded-Host"
curl -s "$DISCOVERY" \
  -H "X-Forwarded-Proto: https" -H "X-Forwarded-Host: ${FWD_HOST}" | show_endpoints

echo
echo "### 3. discovery, Host: ${FWD_HOST} + X-Forwarded-Proto: https"
curl -s "$DISCOVERY" \
  -H "Host: ${FWD_HOST}" -H "X-Forwarded-Proto: https" | show_endpoints

echo
echo "### 4. /authorize, interactiveLogin=false, no subject"
curl -s -o /dev/null -D - \
  "${BASE}/authorize?response_type=code&client_id=probe-client&redirect_uri=http://127.0.0.1:45678/callback&scope=openid%20profile%20email&state=st123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256" \
  | grep -iE '^(HTTP/|location:)'

echo
echo "### 5. /authorize with login_hint"
curl -s -o /dev/null -D - \
  "${BASE}/authorize?response_type=code&client_id=probe-client&redirect_uri=http://127.0.0.1:45678/callback&scope=openid&state=st1&login_hint=bob@example.test" \
  | grep -iE '^(HTTP/|location:)'

echo
echo "### 6. container logs (tail)"
docker logs "$NAME" 2>&1 | tail -25

echo
echo "### cleanup"
docker rm -f "$NAME" >/dev/null 2>&1 && echo done
