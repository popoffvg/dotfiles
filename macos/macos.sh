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

# --- Caps Lock = language switch only (no uppercase lock) ---
# Remap Caps Lock → F18 (Keychron Q11: vendor 13364, product 480)
defaults -currentHost write -g "com.apple.keyboard.modifiermapping.13364-480-0" -array \
  '<dict><key>HIDKeyboardModifierMappingSrc</key><integer>30064771129</integer><key>HIDKeyboardModifierMappingDst</key><integer>30064771181</integer></dict>'
hidutil property --set '{"UserKeyMapping":[{"HIDKeyboardModifierMappingSrc":0x700000039,"HIDKeyboardModifierMappingDst":0x70000006D}]}' >/dev/null
# Bind "Select previous input source" to F18
defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict-add 60 \
  '<dict><key>enabled</key><true/><key>value</key><dict><key>parameters</key><array><integer>63279</integer><integer>79</integer><integer>0</integer></array><key>type</key><string>standard</string></dict></dict>'
/System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u 2>/dev/null || true

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
