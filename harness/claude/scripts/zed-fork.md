---
name: zed-fork.sh
description: Run the Zed CLI built from the fork at ~/Documents/git/zed against the fork's own app binary, in place of the vanilla Zed.app.
args: "[any zed CLI args]"
env: "ZED_FORK_DIR (default ~/Documents/git/zed), ZED_FORK_PROFILE (debug | release, default debug)"
needs: "`cargo build -p cli -p zed` in the fork; ~/.local/bin/zed symlinked to this script"
used_by: open-file.sh, zed-diff.sh, zed-edit-return.sh, line-comment reveal — through `zed` on PATH
---
