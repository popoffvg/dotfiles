#!/usr/bin/env bash
# Verify the DEPLOYED openclaw blogs X handler fetches a URL correctly.
#
# Runs the server's own harness/extensions/blogs/fetch/handlers/x.ts against the
# live X API with the telepi service env (TWITTER_BEARER_TOKEN), and prints the
# resolved title + a body excerpt per URL. The handler's only import is
# `import type` (erased), so plain `node --experimental-strip-types` loads the
# deployed file unmodified — no build, no pi session, no vault write.
#
# Usage: openclaw-verify-fetch.sh <x-url> [<x-url>...]
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $(basename "$0") <x-url> [<x-url>...]" >&2
  exit 2
fi

EXT_DIR=${OPENCLAW_EXT_DIR:-/home/deploy/.pi/agent/extensions/blogs}
ENV_FILE=${OPENCLAW_ENV_FILE:-/home/deploy/.config/telepi/config.env}

remote_script() {
  cat <<'REMOTE'
set -euo pipefail
ext_dir="$1"; shift
env_file="$1"; shift
set -a; . "$env_file"; set +a

cat >/tmp/verify-x-fetch.mjs <<'JS'
const [extDir, ...urls] = process.argv.slice(2);
const { XHandler } = await import(`${extDir}/fetch/handlers/x.ts`);
for (const url of urls) {
  console.log(`--- ${url}`);
  console.log(`  matches ${XHandler.matches(url)}`);
  try {
    const r = await XHandler.fetch(url);
    console.log(`  OK      title="${r.title}" chars=${r.markdown.length}`);
    console.log(`  body    ${r.markdown.slice(0, 500).replace(/\n+/g, ' ⏎ ')}`);
  } catch (e) {
    console.log(`  FAIL    ${e?.message ?? String(e)}`);
  }
}
JS

node --experimental-transform-types --no-warnings /tmp/verify-x-fetch.mjs "$ext_dir" "$@"
rm -f /tmp/verify-x-fetch.mjs
REMOTE
}

# shellcheck disable=SC2029
remote_script | ssh openclaw "bash -s -- '$EXT_DIR' '$ENV_FILE' $(printf "'%s' " "$@")"
