!#/bin/sh

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# ln ~/.tmux.conf $SCRIPT_DIR/../tmux/.tmux.conf
# ln ~/.alacritty.yml $SCRIPT_DIR/../alacritty/alacritty.yml
mkdir ~/.config/nvim || true
sudo mount --bind  "$SCRIPT_DIR/../nvim ~/.config/nvim" || true
# ln ~/.zshrc $SCRIPT_DIR/../zsch

