#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Fill LICENSE_KEY, LDAP_SEARCH_PASSWORD and GOOGLE_CLIENT_SECRET in a
cf-deploy.params file from the live app.hz (Hetzner) cluster, without printing
any of the values.

  cf-params-fill-from-hz.sh [PARAMS_FILE] [--context CTX] [--namespace NS]
                            [--sso-namespace NS]

Defaults: PARAMS_FILE from $CF_PARAMS, else
          ~/git/mil/tasks/MILAB-6670-multiprovider-ui/.notes/cf-deploy.params
          --context hz  --namespace platforma-app  --sso-namespace platforma-e2e

Sources (documented in pl/helm/internal/values-hz-app.yaml:15-35 and
pl/helm/values-hz-staging.yaml:20-30):
  secret platforma-license            key MI_LICENSE     -> LICENSE_KEY
  secret platforma-ldap-password      key password       -> LDAP_SEARCH_PASSWORD
  secret platforma-sso-client-secret  key client-secret  -> GOOGLE_CLIENT_SECRET

The SSO secret sits in the staging release's own namespace rather than
platforma-app, which is why it takes a separate --sso-namespace.

Prints only which keys were filled and how many FILL_ME values remain.
Idempotent: re-running overwrites the same values.
EOF
}

DEFAULT_PARAMS=$HOME/git/mil/tasks/MILAB-6670-multiprovider-ui/.notes/cf-deploy.params
PARAMS=${CF_PARAMS:-$DEFAULT_PARAMS}
CONTEXT=hz
NAMESPACE=platforma-app
SSO_NAMESPACE=platforma-e2e

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)   usage; exit 0 ;;
    --context)   CONTEXT=$2; shift 2 ;;
    --namespace) NAMESPACE=$2; shift 2 ;;
    --sso-namespace) SSO_NAMESPACE=$2; shift 2 ;;
    -*)          echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
    *)           PARAMS=$1; shift ;;
  esac
done

[[ -f $PARAMS ]] || { echo "params file not found: $PARAMS" >&2; exit 2; }

read_secret() {
  local secret=$1 key=$2 ns=${3:-$NAMESPACE} val
  val=$(kubectl --context "$CONTEXT" -n "$ns" get secret "$secret" \
          -o "jsonpath={.data.$key}" 2>/dev/null | base64 -d 2>/dev/null) || true
  [[ -n $val ]] || { echo "could not read $secret/$key from $CONTEXT/$ns" >&2; return 1; }
  printf '%s' "$val"
}

set_param() {
  local name=$1 value=$2
  NAME=$name VALUE=$value perl -i -pe '
    BEGIN { $n = $ENV{NAME}; $v = $ENV{VALUE}; $q = chr(39); }
    s/^\Q$n\E=.*/$n . "=" . $q . $v . $q/e;
  ' "$PARAMS"
}

filled=()
if v=$(read_secret platforma-license MI_LICENSE); then
  set_param LICENSE_KEY "$v"; filled+=(LICENSE_KEY)
fi
if v=$(read_secret platforma-ldap-password password); then
  set_param LDAP_SEARCH_PASSWORD "$v"; filled+=(LDAP_SEARCH_PASSWORD)
fi
if v=$(read_secret platforma-sso-client-secret client-secret "$SSO_NAMESPACE"); then
  set_param GOOGLE_CLIENT_SECRET "$v"; filled+=(GOOGLE_CLIENT_SECRET)
fi
unset v

if [[ ${#filled[@]} -eq 0 ]]; then
  echo "nothing filled — params file left untouched" >&2
  exit 1
fi

echo "filled: ${filled[*]}"
remaining=$(grep -cE '^[A-Z0-9_]+=FILL_ME' "$PARAMS" || true)
echo "FILL_ME remaining: $remaining"
[[ $remaining == 0 ]] && echo "ready: deploy-platforma-cf.sh all --repo <path>/pl --dry-run"
