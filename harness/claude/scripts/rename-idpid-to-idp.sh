#!/usr/bin/env bash
# Rename the "id of the IdP" identifier family to plain IdP/idP across Go sources.
#
# Token-exact by design: a naive substring replace corrupts unrelated names,
# because validPassword, midpoint, cidPrime and InvalidProof all literally
# contain "idP"/"idp". Every pattern below is \b-anchored, which also keeps
# compound tokens from being half-rewritten (\bidpID\b never matches idpIDs).
#
# Deliberately NOT touched:
#   - util/oidc/localsessionstore/record.go  json:"idpId"  (persisted session
#     records; renaming the tag orphans every live session)
#   - CHANGELOG.md and .changes/*.md         (a record of what already shipped)
#   - plapi/plapiproto/*.pb.go               (generated; proto field is already "idp")
#   - samlIdp* names                         (SAML entity/metadata fields, a different id)
#
# Usage: rename-idpid-to-idp.sh <repo-root>
set -euo pipefail

root="${1:?usage: rename-idpid-to-idp.sh <repo-root>}"
cd "$root"

# Longest / most specific first, though \b anchoring makes order non-critical.
pairs=(
  'KnownIdpIDs:KnownIdPs'
  'TestSSODescription_UntitledKeepsIdPID:TestSSODescription_UntitledKeepsIdP'
  'TestManager_Store_UnknownIdPID:TestManager_Store_UnknownIdP'
  'legacySSOIdPID:legacySSOIdP'
  'ssoTestIdPID:ssoTestIdP'
  'writtenByIdpID:writtenByIdP'
  'originIdpID:originIdP'
  'lastIdPID:lastIdP'
  'LastIdPID:LastIdP'
  'idpIDs:idPs'
  'idpIds:idPs'
  'IdPID:IdP'
  'IdpID:IdP'
  'idpID:idP'
  'idpId:idP'
)

mapfile -t files < <(
  find . -name '*.go' -type f \
    -not -path './.git/*' \
    -not -name '*.pb.go' \
    -not -name '*_grpc.pb.go' \
  | sort
)

echo "scanning ${#files[@]} Go files"

for pair in "${pairs[@]}"; do
  from="${pair%%:*}"
  to="${pair##*:}"
  hits=$(grep -rlE "\\b${from}\\b" "${files[@]}" 2>/dev/null || true)
  if [ -z "$hits" ]; then
    echo "  ${from} -> ${to}: no files"
    continue
  fi
  count=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  printf '%s\n' "$hits" | xargs perl -pi -e "s/\\b${from}\\b/${to}/g"
  echo "  ${from} -> ${to}: ${count} files"
done

# Restore the one wire name that must survive the sweep.
record='util/oidc/localsessionstore/record.go'
if [ -f "$record" ]; then
  perl -pi -e 's/json:"idP"/json:"idpId"/g' "$record"
  echo "restored json:\"idpId\" in ${record}"
fi

echo "done"
