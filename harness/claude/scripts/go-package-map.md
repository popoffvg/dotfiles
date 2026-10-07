---
name: go-package-map.sh
description: Print a markdown map of the imports a Go target directory uses, the direct go.mod deps it never imports, and the exported names of the module's own helper packages.
args: "<module-root> <target-dir> [internal-dir...]"
needs: bash, awk, grep, find
used_by: reuse-audit skill
---
