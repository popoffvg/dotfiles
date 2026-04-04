export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/Users/popoffvg/.cargo/bin
export PATH=$PATH:"$(go env GOPATH)/bin"
export PATH=$PATH:~/local/bin
export PATH=$PATH:/Users/vitaliipopov/.cargo/bin
export PATH=/opt/homebrew/bin:$HOME/.local/share/mise/shims:/sbin:/usr/sbin:$HOME/zk/bin:$PATH

/opt/homebrew/bin/brew shellenv | source

evel $(mise env)

if command -v wt >/dev/null 2>&1; then eval "$(command wt config shell init zsh)"; fi
