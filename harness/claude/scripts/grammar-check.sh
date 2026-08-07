#!/usr/bin/env bash
# Check English grammar of a multiline text with `claude -p` on haiku, and
# collect the topic of every fix into a running log so recurring weak spots
# become visible over time.
#
# Usage:
#   grammar-check.sh <file>          # check the text in <file> (multiline safe)
#   grammar-check.sh -               # check text read from stdin
#   grammar-check.sh --topics [N]    # show the N most frequent fix topics (default 15)
#
# Flags: --quiet suppresses the trailing topic summary (for callers that parse
# the model output, e.g. the Raycast extension).
#
# Log: $GRAMMAR_LOG (default ~/ctx/grammar/topics.tsv), one row per fix:
#   <iso-date>\t<topic-slug>\t<explanation>\t<context>
set -euo pipefail

LOG=${GRAMMAR_LOG:-$HOME/ctx/grammar/topics.tsv}
MODEL=${GRAMMAR_MODEL:-haiku}

# claude looks up its stored credentials by user name and answers
# "Not logged in · Please run /login" when USER is unset, which happens when the
# caller is an app rather than a login shell.
export USER=${USER:-$(id -un)}

# Raycast and launchd start processes with a minimal PATH, so `claude` is often
# not resolvable there.
CLAUDE_BIN=${GRAMMAR_CLAUDE_BIN:-}
if [ -z "$CLAUDE_BIN" ]; then
  CLAUDE_BIN=$(command -v claude 2>/dev/null || true)
fi
for candidate in "$HOME/.local/bin/claude" /opt/homebrew/bin/claude /usr/local/bin/claude; do
  [ -n "$CLAUDE_BIN" ] && break
  [ -x "$candidate" ] && CLAUDE_BIN=$candidate
done

show_topics() {
  local limit=${1:-15}
  if [ ! -s "$LOG" ]; then
    echo "no fixes logged yet ($LOG)"
    return 0
  fi
  echo "# recurring fix topics — $(wc -l <"$LOG" | tr -d ' ') fixes logged in $LOG"
  cut -f2 "$LOG" | sort | uniq -c | sort -rn | head -n "$limit" |
    awk '{ printf "%5d  %s\n", $1, $2 }'
}

quiet=0
if [ "${1:-}" = "--quiet" ]; then
  quiet=1
  shift
fi

case "${1:-}" in
  --topics)
    show_topics "${2:-15}"
    exit 0
    ;;
  "")
    echo "usage: grammar-check.sh [--quiet] <file> | - | --topics [N]" >&2
    exit 2
    ;;
esac

if [ -z "$CLAUDE_BIN" ]; then
  echo "grammar-check.sh: claude CLI not found; set GRAMMAR_CLAUDE_BIN" >&2
  exit 127
fi

src=$1
if [ "$src" = "-" ]; then
  src=$(mktemp "${TMPDIR:-/tmp}/grammar-in.XXXXXX")
  trap 'rm -f "$src"' EXIT
  cat >"$src"
elif [ ! -f "$src" ]; then
  echo "grammar-check.sh: no such file: $src" >&2
  exit 2
fi

if [ ! -s "$src" ]; then
  echo "grammar-check.sh: input is empty" >&2
  exit 2
fi

# Read, not prompt=$(cat <<'PROMPT'…): macOS /bin/bash is 3.2, and it mis-parses
# an apostrophe inside a here-document that sits in a command substitution
# ("unexpected EOF while looking for matching `''"). read -d '' hits EOF and
# returns non-zero, hence the || true under set -e.
IFS= read -r -d '' prompt <<'PROMPT' || true
You are an English grammar checker. The text to check follows after the line
"=== TEXT ===". It may be multiline; keep its line breaks, code, paths, and
identifiers exactly as they are. Fix only grammar, spelling, articles,
prepositions, verb forms, word order and punctuation. Do not rewrite style, do
not shorten, do not add or remove ideas.

Answer with exactly these three sections and nothing else:

=== CORRECTED ===
<the full corrected text>
=== TOPICS ===
<one line per distinct kind of mistake you fixed, three TAB-separated fields:
topic-slug<TAB>short explanation of the rule<TAB>context: the wrong fragment
copied from the text, then " -> ", then your corrected fragment>
<omit this section's lines entirely if the text had no mistakes>
=== END ===

topic-slug must be lowercase kebab-case and reusable across texts, e.g.
missing-article, article-a-vs-the, wrong-preposition, subject-verb-agreement,
plural-form, verb-tense, word-order, comma-splice, capitalization, typo.
Use one line per topic, not one line per occurrence.
PROMPT

# --system-prompt replaces the default agent prompt and --safe-mode drops
# CLAUDE.md, hooks, skills and output styles: with any of those in place the
# model answers conversationally and the section markers never appear.
out=$(
  {
    printf '=== TEXT ===\n'
    cat "$src"
  } | "$CLAUDE_BIN" -p --model "$MODEL" --safe-mode --system-prompt "$prompt"
)

# Without this, a refusal or a login prompt would be logged as if it were a
# correction, and the caller would show the text as the fixed variant.
case $out in
  *"=== CORRECTED ==="*) ;;
  *)
    printf 'grammar-check.sh: model answered without the section markers:\n%s\n' "$out" >&2
    exit 3
    ;;
esac

printf '%s\n' "$out"

mkdir -p "$(dirname "$LOG")"
date=$(date +%Y-%m-%d)
printf '%s\n' "$out" |
  awk -v d="$date" '
    /^=== TOPICS ===$/ { inside = 1; next }
    /^=== END ===$/    { inside = 0 }
    inside && NF {
      line = $0
      sub(/^[-*][ \t]+/, "", line)
      fields = split(line, field, "\t")
      slug = field[1]
      if (!(slug in explanation)) { order[++topics] = slug; explanation[slug] = "" }
      if (explanation[slug] == "") explanation[slug] = field[2]
      context = field[3]
      for (i = 4; i <= fields; i++) context = context " " field[i]
      if (context != "" && index(seen[slug], context) == 0)
        seen[slug] = seen[slug] == "" ? context : seen[slug] "; " context
    }
    # one row per topic per run: the model repeats a slug when the same kind of
    # mistake appears twice, and then only the context differs
    END {
      for (i = 1; i <= topics; i++)
        print d "\t" order[i] "\t" explanation[order[i]] "\t" seen[order[i]]
    }
  ' >>"$LOG"

if [ "$quiet" = 0 ]; then
  echo
  show_topics 10
fi
