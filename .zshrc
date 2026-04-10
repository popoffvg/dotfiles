
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

export EDITOR=hx
autoload -z edit-command-line
function edit-command-line-trim() {
  edit-command-line
  BUFFER="${BUFFER%%$'\n'}"
}
zle -N edit-command-line-trim
bindkey '^O' edit-command-line-trim

if command -v wt >/dev/null 2>&1; then eval "$(command wt config shell init zsh)"; fi

# Source satellite configs
for f in ~/.zshrc_*; do
  [[ -f "$f" ]] && source "$f"
done


# Kiro CLI post block. Keep at the bottom of this file.
[[ -f "${HOME}/Library/Application Support/kiro-cli/shell/zshrc.post.zsh" ]] && builtin source "${HOME}/Library/Application Support/kiro-cli/shell/zshrc.post.zsh"
