---
name: go-rename-package.py
description: Drive gopls over stdio to rename one Go package with renameMovesSubpackages on, and apply the returned WorkspaceEdit — text edits, directory move, deletions — to the working tree.
args: "--root DIR --file FILE --line N --col N --new-name NAME [--git]"
requires: gopls, python3 (stdlib only)
writes: source files across the module, and the package directory
called-by: go-rename-package.sh
---
