---
name: hc-hibernate.py
description: Stop Claude Code sessions that sit idle in Herdr Core terminals, and leave `claude --resume <session>` at the shell prompt so Enter brings each one back.
args: "sweep [<terminal>...] [--idle-minutes N] [--dry-run] | watch [--idle-minutes N] | wake (<terminal>... | --all)"
needs: hc (Herdr Core); run outside the command sandbox, because it reads every process and the hc socket
used_by: the LaunchAgent `com.vitalii.hc-hibernate` (`macos/com.vitalii.hc-hibernate.plist`), which runs `watch` at login
---
