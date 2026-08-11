#!/usr/bin/env bash
# Print the environment a session ran in: its topic, its span, and every
# project that was in context.
#
# Written beside an archived transcript as a sidecar (`<archive>.env.md`) so a
# later batch /dream harvest can tell which repos a correction came from
# without parsing megabytes of JSONL — and can still tell after the working
# directories are gone.
#
# Where the facts come from:
#   topic     the last `ai-title` entry — the harness's own session title,
#             so no inference is needed here.
#   projects  the distinct `cwd` + `gitBranch` pairs on transcript entries,
#             collapsed to one row per git repo root. Collapsing matters: a
#             cwd inside `node_modules/` or a nested package resolves to the
#             same root as the repo itself, and would otherwise look like a
#             separate project.
#   remote    `git remote get-url origin` at the resolved root. Resolution
#             needs the directory to still exist; a temp dir that has since
#             been deleted degrades to the raw cwd with no root and no remote.
set -euo pipefail

if [ $# -ne 1 ]; then
  printf 'usage: %s <transcript.jsonl>\n' "$(basename "$0")" >&2
  exit 2
fi

transcript=$1
if [ ! -f "$transcript" ]; then
  printf 'no transcript at %s\n' "$transcript" >&2
  exit 1
fi

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

session_id=$(basename "$transcript" .jsonl)

topic=$("$script_dir/session-title.sh" "$transcript")

# One jq pass for every remaining scalar. Piping jq into `head`/`tail` instead
# would close jq's stdout early, and SIGPIPE plus `set -o pipefail` aborts the
# script with no output.
IFS=$'\t' read -r first_ts last_ts human_prompts < <(jq -rs '
  [.[] | select(.timestamp) | .timestamp] as $stamps
  | [($stamps | first) // "", ($stamps | last) // "",
     ([.[] | select(.type == "user" and .origin.kind == "human")] | length)]
  | @tsv
' "$transcript")

[ -n "$topic" ] || topic="(no ai-title in transcript)"

printf '# Session env\n\n'
printf -- '- **Session:** %s\n' "$session_id"
printf -- '- **Topic:** %s\n' "$topic"
printf -- '- **Span:** %s → %s\n' "${first_ts:-unknown}" "${last_ts:-unknown}"
printf -- '- **Human prompts:** %s\n\n' "$human_prompts"

printf '## Projects in context\n\n'
printf '| repo root | branch | entries | remote |\n'
printf '|---|---|---|---|\n'

# One line per distinct cwd+branch, prefixed with its entry count, then
# re-keyed on the resolved repo root and summed. `entries` counts transcript
# records stamped with that cwd — a size proxy, not a count of user turns.
jq -r 'select(.cwd != null) | "\(.cwd)\t\(.gitBranch // "-")"' "$transcript" \
  | sort | uniq -c | sed -e 's/^ *\([0-9]*\) /\1	/' \
  | while IFS=$'\t' read -r count cwd branch; do
      if root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null); then
        remote=$(git -C "$cwd" remote get-url origin 2>/dev/null || echo '-')
      else
        root="$cwd (no git repo here now)"
        remote='-'
      fi
      printf '%s\t%s\t%s\t%s\n' "$root" "$branch" "$count" "$remote"
    done \
  | awk -F'\t' '
      { key = $1 FS $2; total[key] += $3; remote[key] = $4 }
      END { for (k in total) { split(k, p, FS); print total[k] "\t" p[1] "\t" p[2] "\t" remote[k] } }
    ' \
  | sort -rn \
  | while IFS=$'\t' read -r count root branch remote; do
      printf '| `%s` | %s | %s | %s |\n' "$root" "$branch" "$count" "$remote"
    done
