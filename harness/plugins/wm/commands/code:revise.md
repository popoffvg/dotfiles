---
name: code:revise
description: "Settle drift from a delta manifest, patching only stale notes and spec sections; resets the spec `status` to `review`."
context: fork
agent: wm:architector
background: false
---

Load the `code` skill and run its `revise` subcommand with these arguments: $ARGUMENTS
