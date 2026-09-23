---
name: go-rename-package.sh
description: Pick a Go package with fzf, type its new name in the editor, then rename the package clause, its directory, and every reference through gopls.
args: "[module-dir]  # defaults to $PWD; resolved up to the go.mod"
env: "EDITOR (default hx)"
requires: go, gopls, fzf, python3, column
writes: source files across the module, and the package directory (git mv when tracked)
pairs-with: go-rename-package.py
---
