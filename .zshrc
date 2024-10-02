export PATH=$PATH:/opt/homebrew/bin:$HOME/.local/share/mise/shims:/sbin:/usr/sbin:$HOME/zk/bi
export ZK_PATH="'/Users/popoffvg/Library/Mobile Documents/iCloud~md~obsidian/Documents/Z-Core/'"

bindkey '^f' autosuggest-accept

# if [ -z "$TMUX" ]
# then
#     tmux attach -t TMUX || tmux new -s TMUX > /dev/null
# fi



### Added by Zinit's installer
if [[ ! -f $HOME/.local/share/zinit/zinit.git/zinit.zsh ]]; then
    print -P "%F{33} %F{220}Installing %F{33}ZDHARMA-CONTINUUM%F{220} Initiative Plugin Manager (%F{33}zdharma-continuum/zinit%F{220})…%f"
    command mkdir -p "$HOME/.local/share/zinit" && command chmod g-rwX "$HOME/.local/share/zinit"
    command git clone https://github.com/zdharma-continuum/zinit "$HOME/.local/share/zinit/zinit.git" && \
        print -P "%F{33} %F{34}Installation successful.%f%b" || \
        print -P "%F{160} The clone has failed.%f%b"
fi

source "$HOME/.local/share/zinit/zinit.git/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit

# Load a few important annexes, without Turbo
# (this is currently required for annexes)
zinit light-mode for \
    zdharma-continuum/zinit-annex-as-monitor \
    zdharma-continuum/zinit-annex-bin-gem-node \
    zdharma-continuum/zinit-annex-patch-dl \
    zdharma-continuum/zinit-annex-rust

### End of Zinit's installer chunk


zi light sebastiangraz/c
zi light MohamedElashri/fd-zsh
zi light zsh-users/zsh-autosuggestions
zi light sroze/docker-compose-zsh-plugin
zi light hlissner/zsh-autopair
zi light zsh-users/zsh-syntax-highlighting
zi light Aloxaf/fzf-tab
zi light plutowang/zsh-ollama-command
zi light unixorn/git-extra-commands
zi light loiccoyle/zsh-github-copilot
zi light Aloxaf/fzf-tab
# zi light remino/omz-plugin-git-aliases

zi snippet OMZP::git-extras
zi snippet OMZP::git
zi snippet OMZP::colorize
zi snippet OMZP::cp
zi snippet OMZP::mvn
zi snippet OMZP::fzf
zi snippet OMZP::kubectl
zi snippet OMZP::golang
# zi snippet OMZP::tmux
zi snippet OMZP::zoxide
zi snippet OMZP::eza


zi ice as"completion"
zi snippet OMZP::gitfast

zi ice as"completion"
zi snippet OMZP::git-commit

# zi ice as"completion"
# zi snippet OMZP::fd/_fd

eval "$(thefuck --alias)"
eval "$(zoxide init --no-aliases zsh)"
eval "$(oh-my-posh init zsh --config ~/.config/.oh-my-posh.json)"
eval "$(direnv hook $SHELL)"
eval "$(atuin init zsh)"

alias ..="z .."
alias ...="z ../.."
alias ....="z ../../.."
alias .....="z ../../../.."
alias vi=nvim
alias k=kubectl
# alias go="grc go"
alias gita="git add . && git commit --amend -C HEAD && git push -f"
alias g="git"
alias ff="fuck"
alias fy="fuck -y"
alias ls="eza --icons=always"
alias cd="z"
alias gfix="TARGET=\$1; shift; git commit -a --fixup=\$TARGET \"\${@:2}\" && EDITOR=true git rebase -i --autostash --autosquash \$TARGET~1; "
alias zk="cd '/Users/popoffvg/Library/Mobile Documents/iCloud~md~obsidian/Documents/Z-Core/';vi"

bindkey '^e' zsh_gh_copilot_explain
bindkey '^g' zsh_gh_copilot_suggest

ZVM_VI_ESCAPE_BINDKEY=jj

# only for git
zstyle ':completion:*:*:git:*' fzf-search-display true
# or for everything
zstyle ':completion:*' fzf-search-display true

zstyle :compinstall filename "${ZDOTDIR:-$HOME}/.zshrc"

autoload -Uz compinit
compinit

# direnv

export GOPATH=~/go
export PATH=$PATH:$GOPATH/bin
export PATH=$PATH:~/.local/bin

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# The next line updates PATH for Yandex Cloud CLI.
if [ -f '/Users/popoffvg/yandex-cloud/path.bash.inc' ]; then source '/Users/popoffvg/yandex-cloud/path.bash.inc'; fi

# The next line enables shell command completion for yc.
if [ -f '/Users/popoffvg/yandex-cloud/completion.zsh.inc' ]; then source '/Users/popoffvg/yandex-cloud/completion.zsh.inc'; fi

source ~/.zshrc.mise
source ~/.zshrc.zoxide
source ~/.zshrc.git
source ~/.zshrc.broot

source /Users/popoffvg/.config/broot/launcher/bash/br
