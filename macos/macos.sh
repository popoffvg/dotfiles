#!/usr/bin/env bash
# macOS system settings — snapshot of the current machine's `defaults`.
# Idempotent: re-running only re-applies values. Run: ./macos.sh
# Regenerate after changing System Settings by re-reading the keys below.
set -euo pipefail

echo "Applying macOS defaults…"

# --- Keyboard ---
defaults write -g ApplePressAndHold -bool false          # hold key repeats, no accent menu
defaults write -g KeyRepeat -int 1                       # fastest repeat
defaults write -g InitialKeyRepeat -int 12               # short delay before repeat
defaults write -g AppleKeyboardUIMode -int 2             # full keyboard access
defaults write -g NSAutomaticCapitalizationEnabled -bool true
defaults write -g NSAutomaticSpellingCorrectionEnabled -bool false
defaults write -g NSAutomaticPeriodSubstitutionEnabled -bool true

# --- Trackpad / scroll ---
defaults write -g com.apple.swipescrolldirection -bool false   # "natural" scroll off
defaults write com.apple.AppleMultitouchTrackpad Clicking -bool true            # tap to click
defaults write com.apple.AppleMultitouchTrackpad TrackpadThreeFingerDrag -bool false
defaults write com.apple.AppleMultitouchTrackpad FirstClickThreshold -int 0
defaults write com.apple.AppleMultitouchTrackpad SecondClickThreshold -int 0

# --- Dock ---
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock tilesize -int 51
defaults write com.apple.dock magnification -bool true
defaults write com.apple.dock largesize -int 41
defaults write com.apple.dock minimize-to-application -bool true
defaults write com.apple.dock show-recents -bool false
defaults write com.apple.dock mru-spaces -bool false     # don't reorder spaces by use

# --- Finder ---
defaults write com.apple.finder ShowPathbar -bool true
defaults write com.apple.finder ShowStatusBar -bool true
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"   # list view
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"   # search current folder
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true
defaults write com.apple.finder ShowHardDrivesOnDesktop -bool false

# --- Screenshots ---
defaults write com.apple.screencapture show-thumbnail -bool true

# --- Restart affected apps ---
for app in Dock Finder SystemUIServer; do
  killall "$app" >/dev/null 2>&1 || true
done

echo "Done. Some settings need logout/restart to fully apply."
