#!/usr/bin/env bash
# Re-key the openclaw-infra ansible-vault when the old password is lost.
# Reconstructs vault.yml from the server's rendered config (so no old password
# needed), encrypts it with a NEW random password, updates the macOS Keychain,
# and prints the new password ONCE so you can update the GitHub secret.
#
# Secrets never print except the final new vault password (needed for GitHub).
#
# Usage:  openclaw-vault-rekey.sh [REPO_DIR]
#   REPO_DIR defaults to the current directory; must be the openclaw-infra repo.
set -euo pipefail

REPO="${1:-$PWD}"
SSH_HOST="openclaw"
REMOTE_ENV='$HOME/.config/telepi/config.env'
VAULT="$REPO/ansible/inventory/group_vars/openclaw/vault.yml"
VARS="$REPO/ansible/inventory/group_vars/openclaw/vars.yml"
KC_ACCT="ansible-vault"
KC_SVC="openclaw-vault"

[ -f "$VAULT" ] || { echo "ERROR: vault not found at $VAULT — is REPO_DIR correct?" >&2; exit 1; }
[ -d "$REPO/.venv" ] || { echo "ERROR: $REPO/.venv missing — run 'mise run setup' first" >&2; exit 1; }
# shellcheck disable=SC1091
source "$REPO/.venv/bin/activate"
command -v ansible-vault >/dev/null || { echo "ERROR: ansible-vault not on PATH" >&2; exit 1; }

echo "==> Reading rendered secrets from $SSH_HOST ..."
REMOTE_CONTENT="$(ssh "$SSH_HOST" "cat $REMOTE_ENV")" \
  || { echo "ERROR: failed to read $REMOTE_ENV from $SSH_HOST" >&2; exit 1; }

echo "==> Reading new Discord token from vars.yml ..."
DISCORD_TOKEN="$(grep -E '^[[:space:]]*vault_discord_bot_token:' "$VARS" \
  | head -1 | sed -E "s/^[^:]+:[[:space:]]*//; s/^['\"]//; s/['\"][[:space:]]*$//")"
[ -n "$DISCORD_TOKEN" ] && [ "$DISCORD_TOKEN" != "CHANGEME_DISCORD_BOT_TOKEN" ] \
  || { echo "ERROR: real vault_discord_bot_token not found in vars.yml" >&2; exit 1; }

echo "==> Generating new vault password ..."
NEW_PW="$(openssl rand -base64 32)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PLAIN="$WORK/vault.plain.yml"
PWFILE="$WORK/pw"
printf '%s' "$NEW_PW" > "$PWFILE"
printf '%s' "$REMOTE_CONTENT" > "$WORK/remote.env"
printf '%s' "$DISCORD_TOKEN" > "$WORK/discord.tok"

echo "==> Building fresh vault.yml ..."
python3 - "$WORK/remote.env" "$WORK/discord.tok" "$PLAIN" <<'PY'
import sys, json
env_path, tok_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
env = {}
for line in open(env_path):
    line = line.rstrip("\n")
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v
def need(k):
    if k not in env:
        sys.exit(f"ERROR: {k} missing from server config.env — cannot reconstruct vault")
    return env[k]
data = {
    "vault_telegram_bot_token":   need("TELEGRAM_BOT_TOKEN"),
    "vault_telegram_user_id":     need("TELEGRAM_ALLOWED_USER_IDS"),
    "vault_opencode_api_token":   need("OPENCODE_API_KEY"),
    "vault_firecrawl_api_key":    need("FIRECRAWL_API_KEY"),
    "vault_twitter_bearer_token": need("TWITTER_BEARER_TOKEN"),
    "vault_bird_auth_token":      need("AUTH_TOKEN"),
    "vault_bird_ct0":             need("CT0"),
    "vault_discord_bot_token":    open(tok_path).read(),
}
# JSON is valid YAML — Ansible parses a JSON group_vars file fine, and this
# avoids a PyYAML dependency in the venv.
with open(out_path, "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
    f.write("\n")
print(f"   reconstructed {len(data)} keys")
PY

# Run ansible-vault against an EMPTY config (and with any inherited
# ANSIBLE_VAULT_PASSWORD_FILE removed) so ONLY our explicit --vault-password-file
# registers a vault identity. Otherwise the project ansible.cfg's
# vault_password_file + the explicit flag both map to id "default" and
# ansible-vault refuses to pick. (ANSIBLE_CONFIG must point to a real *.cfg.)
EMPTY_CFG="$WORK/empty.cfg"
printf '[defaults]\n' > "$EMPTY_CFG"
av() { env -u ANSIBLE_VAULT_PASSWORD_FILE ANSIBLE_CONFIG="$EMPTY_CFG" ansible-vault "$@"; }

echo "==> Encrypting with new password ..."
av encrypt --vault-password-file "$PWFILE" --output "$VAULT" "$PLAIN"

echo "==> Verifying decryption ..."
av view "$VAULT" --vault-password-file "$PWFILE" >/dev/null \
  && echo "   OK: vault decrypts with the new password"

echo "==> Updating macOS Keychain entry ..."
security add-generic-password -a "$KC_ACCT" -s "$KC_SVC" -U -w "$NEW_PW"
echo "   Keychain updated (account=$KC_ACCT service=$KC_SVC)"

# Write the new password to a 0600 backup file (NOT stdout, to keep it out of
# logs/chat). Delete it once the GitHub secret is confirmed updated.
PW_BACKUP="$REPO/.vault-pass.new"
( umask 077; printf '%s' "$NEW_PW" > "$PW_BACKUP" )
echo "   New password written to $PW_BACKUP (chmod 600) — delete after use."

# Optionally push the GitHub secret directly. Set OPENCLAW_REKEY_GH_REPO=owner/repo.
if [ -n "${OPENCLAW_REKEY_GH_REPO:-}" ] && command -v gh >/dev/null; then
  echo "==> Setting GitHub secret ANSIBLE_VAULT_PASSWORD on $OPENCLAW_REKEY_GH_REPO ..."
  printf '%s' "$NEW_PW" | gh secret set ANSIBLE_VAULT_PASSWORD -R "$OPENCLAW_REKEY_GH_REPO"
  echo "   GitHub secret updated."
else
  echo "   (Skipped GitHub secret push — set OPENCLAW_REKEY_GH_REPO=owner/repo to enable.)"
fi

echo ""
echo "Done. Next: remove the plaintext vault_discord_bot_token from vars.yml,"
echo "      verify with vault-pass.sh, then commit the re-keyed vault.yml."
