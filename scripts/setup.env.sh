!#/bin/sh

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
CURRENT_USER=$USER

# ln ~/.tmux.conf $SCRIPT_DIR/../tmux/.tmux.conf
# ln ~/.alacritty.yml $SCRIPT_DIR/../alacritty/alacritty.yml
mkdir ~/.config/nvim || true
sudo mount --bind  "$SCRIPT_DIR/../nvim" "/home/$CURRENT_USER/config/nvim" || true
# ln ~/.zshrc $SCRIPT_DIR/../zsch

