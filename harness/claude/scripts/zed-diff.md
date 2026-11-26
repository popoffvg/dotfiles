---
name: zed-diff.sh
description: Open a git diff (the working tree, a commit, or a range) in Zed as one multi-diff tab whose right side is the live files when the diff ends at the working tree.
args: "[-C DIR] [--print] [BASE [HEAD] | BASE..HEAD | COMMIT^!] [-- PATH...]"
needs: $EDITOR (default zed) that takes --existing and --diff, such as zed or mized; run outside the command sandbox (Zed answers "Unknown Mach error 44c" inside it)
used_by: line-comment diff view
---
