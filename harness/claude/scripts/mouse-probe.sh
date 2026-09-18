#!/usr/bin/env bash
# Print the raw bytes a terminal sends for mouse events.
# Usage: mouse-probe.sh   -> click and scroll in the window, then press Ctrl-C.
set -u

cleanup() {
  printf '\e[?1006l\e[?1002l\e[?1000l'
  stty "$saved"
  echo
  echo "probe ended"
}

saved=$(stty -g)
trap cleanup EXIT
stty raw -echo
printf '\e[?1000h\e[?1002h\e[?1006h'
echo "Click and scroll now. Ctrl-C to stop."
cat -v
