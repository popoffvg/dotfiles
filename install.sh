!#/bin/sh

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install 'font-fira-mono-nerd-font'
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# for prement tpm problem
brew install tmux

mise install neovim@0.10.0
