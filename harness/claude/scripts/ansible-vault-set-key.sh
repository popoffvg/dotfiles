#!/usr/bin/env bash
# ansible-vault-set-key.sh — add or replace one key in a JSON ansible-vault file, non-interactively.
#
# `ansible-vault edit` opens $EDITOR, which an agent cannot drive. Decrypting to a temp file and
# re-encrypting leaves the plaintext secret on disk, where a crash or a stray `git add` can strand
# it. This pipes decrypt -> jq -> encrypt, so the cleartext exists only in the pipe.
#
# The VALUE is read from the environment, never from argv: argv is visible to `ps` for every user
# on the box and lands in shell history.
#
# Usage:  VAULT_VALUE='the-secret' ansible-vault-set-key.sh <vault-file> <password-file> <key-name>
# Exits nonzero without writing if the decrypt, the jq edit, or the re-encrypt fails.
#
# --encrypt-vault-id is passed explicitly: when a config makes more than one vault-id available,
# `encrypt` refuses rather than guessing. Override with VAULT_ID if the repo uses a named id.
set -euo pipefail

file=${1:?vault file required}
passfile=${2:?vault password file required}
key=${3:?key name required}
: "${VAULT_VALUE:?VAULT_VALUE must be set in the environment}"

[ -f "$file" ] || { echo "no vault file at $file" >&2; exit 1; }

tmp=$(mktemp "${TMPDIR:-/tmp}/vault-reencrypt.XXXXXX")
# The temp file only ever holds CIPHERTEXT: encrypt writes to it, then it is moved into place.
trap 'rm -f "$tmp"' EXIT

ansible-vault view --vault-password-file "$passfile" "$file" \
  | jq --arg k "$key" --arg v "$VAULT_VALUE" '. + {($k): $v}' \
  | ansible-vault encrypt --vault-password-file "$passfile" \
      --encrypt-vault-id "${VAULT_ID:-default}" --output "$tmp" -

# Prove the result decrypts and carries the key before replacing the original.
ansible-vault view --vault-password-file "$passfile" "$tmp" | jq -e --arg k "$key" 'has($k)' >/dev/null

mv "$tmp" "$file"
trap - EXIT
echo "set $key in $file"
