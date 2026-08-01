#!/usr/bin/env bash
# Insert a `topic:` line into a Z-Core vault note's YAML frontmatter.
#
# Usage: set-note-topic.sh <file.md> <topic[,topic,...]>
#   set-note-topic.sh 20-notes/foo.md ai,performance
#
# Idempotent: a note that already has `topic:` is left untouched (exit 0, prints SKIP-has-topic).
# Notes without frontmatter are NOT modified (exit 2, prints SKIP-no-frontmatter) — adding a
# topic there would produce a note still missing created/source/type, which the linter rejects.
#
# Every topic is validated against the vault vocabulary ($VAULT/topics.json). An off-list topic
# is refused (exit 3) rather than written, because note-lint blocks such notes on the next write.
set -euo pipefail

VAULT="${PI_VAULT_PATH:-$HOME/obsidian/Z-Core}"

if [[ $# -ne 2 ]]; then
  echo "usage: $(basename "$0") <file.md> <topic[,topic,...]>" >&2
  exit 64
fi

file="$1"
topics_csv="$2"

[[ -f "$file" ]] || { echo "ERR-no-file $file" >&2; exit 66; }

# Approved vocabulary, one topic per line.
allowed=$(python3 -c '
import json,sys
print("\n".join(json.load(open(sys.argv[1]))["topics"]))
' "$VAULT/topics.json")

IFS=',' read -r -a topics <<< "$topics_csv"
[[ ${#topics[@]} -ge 1 ]] || { echo "ERR-no-topics $file" >&2; exit 64; }

clean=()
for t in "${topics[@]}"; do
  t="$(echo "$t" | tr -d '[:space:]')"
  [[ -n "$t" ]] || continue
  if ! grep -qxF "$t" <<< "$allowed"; then
    echo "ERR-bad-topic $file $t" >&2
    exit 3
  fi
  clean+=("$t")
done
[[ ${#clean[@]} -ge 1 ]] || { echo "ERR-no-topics $file" >&2; exit 64; }

# First line must open a frontmatter block.
[[ "$(head -n 1 "$file")" == "---" ]] || { echo "SKIP-no-frontmatter $file"; exit 2; }

if grep -qm1 '^topic:' "$file"; then
  echo "SKIP-has-topic $file"
  exit 0
fi

joined=$(IFS=', '; echo "${clean[*]}")
TOPIC_LINE="topic: [$joined]" perl -i -pe '
  BEGIN { $done = 0; $n = 0 }
  if (!$done && $. > 1 && /^---\s*$/) { $_ = "$ENV{TOPIC_LINE}\n$_"; $done = 1 }
' "$file"

grep -qm1 '^topic:' "$file" || { echo "ERR-insert-failed $file" >&2; exit 4; }
echo "OK $file [$joined]"
