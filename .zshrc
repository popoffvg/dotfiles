
# Kiro CLI pre block. Keep at the top of this file.
[[ -f "${HOME}/Library/Application Support/kiro-cli/shell/zshrc.pre.zsh" ]] && builtin source "${HOME}/Library/Application Support/kiro-cli/shell/zshrc.pre.zsh"

# Extra completions from brew
FPATH=/opt/homebrew/share/zsh-completions:$FPATH

autoload -Uz compinit && compinit

export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/Users/popoffvg/.cargo/bin
export PATH=$PATH:"$(go env GOPATH)/bin"
export PATH=$PATH:~/local/bin
export PATH=/opt/homebrew/bin:$HOME/.local/share/mise/shims:/sbin:/usr/sbin:$HOME/zk/bin:$PATH

eval "$(/opt/homebrew/bin/brew shellenv)"
source <(sk --shell zsh)

autoload -Uz add-zsh-hook

# Report CWD to terminal via OSC 7 so splits open in the same directory
_osc7_cwd() {
  printf '\e]7;file://%s%s\e\\' "${HOST}" "${PWD}"
}
add-zsh-hook chpwd _osc7_cwd
_osc7_cwd

export EDITOR=hx
autoload -z edit-command-line
function edit-command-line-trim() {
  edit-command-line
  BUFFER="${BUFFER%%$'\n'}"
}
zle -N edit-command-line-trim
bindkey '^O' edit-command-line-trim

if command -v wt >/dev/null 2>&1; then eval "$(command wt config shell init zsh)"; fi

get_keychain_secret() {
  security find-generic-password -s "$1" -a "$USER" -w 2>/dev/null
}

if secret="$(get_keychain_secret OPENROUTER_API_KEY)"; then
  export OPENROUTER_API_KEY="$secret"
fi
unset secret

# Source satellite configs
for f in ~/.zshrc_*; do
  [[ -f "$f" ]] && source "$f"
done


# Kiro CLI post block. Keep at the bottom of this file.
[[ -f "${HOME}/Library/Application Support/kiro-cli/shell/zshrc.post.zsh" ]] && builtin source "${HOME}/Library/Application Support/kiro-cli/shell/zshrc.post.zsh"

# pnpm
export PNPM_HOME="/Users/popoffvg/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end
