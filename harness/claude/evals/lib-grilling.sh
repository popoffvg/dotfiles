# Shared by run-grilling.sh and run-grilling-rounds.sh. Source it; do not run it.

grilling_skill_path="harness/claude/skills/grilling/SKILL.md"
grilling_model="${MODEL:-sonnet}"
grilling_jobs="${JOBS:-8}"

for dep in claude jq git; do
  command -v "$dep" >/dev/null || { echo "missing dependency: $dep" >&2; exit 2; }
done

grilling_skill_label() {
  if [ -n "${SKILL_REV:-}" ]; then
    printf '%s@%s' "$(grilling_skill_text | awk '/^version:/{print $2; exit}')" "$SKILL_REV"
  else
    printf '%s@worktree' "$(grilling_skill_text | awk '/^version:/{print $2; exit}')"
  fi
}

grilling_skill_text() {
  local root
  root="$(git -C "$here" rev-parse --show-toplevel)" || return 2
  if [ -n "${SKILL_REV:-}" ]; then
    git -C "$root" show "$SKILL_REV:$grilling_skill_path"
  else
    cat "$root/$grilling_skill_path"
  fi
}

# The skill body: everything after the frontmatter and above `## Output`.
grilling_skill_body() {
  local body
  body="$(grilling_skill_text | awk '/^---$/{n++; next} n>=2' | awk '/^## Output$/{exit} {print}')"
  [ -n "$body" ] || { echo "could not extract the grilling skill body (SKILL_REV=${SKILL_REV:-worktree})" >&2; return 2; }
  printf '%s\n' "$body"
}

# Neutral cwd + project-only settings + no slash commands: the judge must not inherit this
# machine's hooks, plugins, or installed grilling skill, and answers from the prompt alone.
# `--tools ""` removes every tool, so a round comes back as text instead of a refused Write.
# `--tools` takes several values, so the prompt goes on stdin.
grilling_judge() {
  (cd "${TMPDIR:-/tmp}" && printf '%s' "$1" | claude -p --model "${GRILLING_MODEL_OVERRIDE:-$grilling_model}" \
    --setting-sources project --strict-mcp-config \
    --disable-slash-commands --tools "" 2>/dev/null)
}

# The same prompt, model, and repeat index give the stored reply instead of a new call, so a
# control run or an unchanged round costs nothing. NOCACHE=1 forces new calls: a noise check
# needs them. An empty reply is never stored.
grilling_cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/grilling-evals"
grilling_judge_cached() {
  local prompt="$1" slot="${2:-1}" key file reply
  key="$(printf '%s\n%s\n%s' "${GRILLING_MODEL_OVERRIDE:-$grilling_model}" "$slot" "$prompt" | shasum -a 256 | cut -c1-32)"
  file="$grilling_cache_dir/$key"
  if [ -z "${NOCACHE:-}" ] && [ -s "$file" ]; then cat "$file"; return; fi
  reply="$(grilling_judge "$prompt")"
  if [ -n "$reply" ]; then mkdir -p "$grilling_cache_dir" && printf '%s\n' "$reply" > "$file"; fi
  printf '%s\n' "$reply"
}

grilling_throttle() {
  while [ "$(jobs -rp | wc -l)" -ge "$grilling_jobs" ]; do sleep 0.5; done
}
