input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
model=$(echo "$input" | jq -r '.model.display_name // ""')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Real path (for git); keep a display copy with $HOME collapsed to ~.
cwd_real="$cwd"
cwd="${cwd/#$HOME/~}"

parts=""

if [ -n "$cwd" ]; then
  parts="$cwd"
fi

if [ -n "$model" ]; then
  parts="$parts | $model"
fi

if [ -n "$used" ]; then
  used_int=${used%.*}
  parts="$parts | ctx: ${used_int}%"
fi

# wm code mode: show a segment when the current branch is under code mode.
# Logic lives in the wm plugin; local-plugins is a directory marketplace, so the
# plugin runs straight from the repo — reference its bin/ by the repo path.
wm_code_mode="$HOME/git/dotfiles/harness/plugins/wm/bin/wm-code-mode.sh"
if [ -n "$cwd_real" ] && [ -x "$wm_code_mode" ]; then
  seg=$("$wm_code_mode" status "$cwd_real" 2>/dev/null || true)
  [ -n "$seg" ] && parts="$parts | $seg"
fi

printf "%s" "$parts"
