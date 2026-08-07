---
allowed-tools: Bash(~/.claude/scripts/lumen-pane.sh:*)
description: Review the current uncommitted diff in lumen, then act on the annotations
---

Run this in the background, because it blocks until the viewer is closed:

```bash
~/.claude/scripts/lumen-pane.sh --wait lumen-diff --watch
```

Say one line — the pane is open, `i` annotates, `s` then Enter exits and sends
the annotations. Then stop and wait for the script to finish.

When it finishes, print the annotations under `--- annotations ---` and treat
each one as a task on that file and line. Ask before changing anything that the
annotation does not state plainly.

`no annotations` means the viewer was closed with `q`. Say so and stop.
