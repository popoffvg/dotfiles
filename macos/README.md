# macOS settings

System preferences managed as code via `defaults`.

## Files

| File | Purpose |
|---|---|
| `macos.sh` | **Curated, portable** apply script. Hand-picked `defaults write` for keyboard, trackpad, Dock, Finder, screenshots. Safe to commit and replay on any Mac. Runs from the Ansible playbook. |
| `capture.sh` | Dumps **all** `defaults` domains to `dump/<domain>.plist`. For inspecting/migrating a specific machine. |
| `dump/` | Output of `capture.sh`. **Git-ignored** — contains app state and secrets. Regenerate per machine. |

## Apply curated settings

```sh
./macos.sh           # or: ansible-playbook ansible/install_packages.yaml
```

Idempotent — re-running re-applies the same values. Restarts Dock/Finder at the end. Some settings need logout/restart to take effect.

## Capture / migrate a machine

```sh
./capture.sh             # dump every domain (~660 on a typical Mac)
./capture.sh com.apple   # dump only matching domains
```

Restore a single domain on a new machine:

```sh
defaults import com.apple.dock macos/dump/com.apple.dock.plist
killall Dock
```

## Why two paths

The full dump is **not** committed: ~660 domains, mostly third-party app state, caches, and credentials (tokens, analytics IDs). It is neither portable nor safe for version control. `macos.sh` is the curated subset that *is* portable — extend it when you find a setting worth keeping across machines.

To add a setting to `macos.sh`: change it in System Settings, find its key with
`defaults read <domain>` (or `defaults read -g`), then add a `defaults write` line.
