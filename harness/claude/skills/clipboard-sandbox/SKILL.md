---
name: clipboard-sandbox
description: Use when copying content to the clipboard for the user (pbcopy / xclip / clip.exe / wl-copy), e.g. handing a copy-paste command, snippet, or path. Clipboard writes fail silently under the command sandbox — the copy must run sandbox-off and be verified.
---

# Copy to clipboard: sandbox-off + verify

Clipboard writes (`pbcopy` and equivalents) SILENTLY fail under the command sandbox: the command exits 0 but the clipboard is NOT updated, leaving whatever stale content was there. The user then pastes the wrong thing and can't tell.

## Do

1. Run the copy with `dangerouslyDisableSandbox: true`.
2. Verify it took: pipe the clipboard back and grep for a distinctive token from the new content:
   ```bash
   printf '%s\n' "$CONTENT" | pbcopy
   pbpaste | grep -F '<distinctive-token>'   # must print a line
   ```
   `pbpaste` under the sandbox also returns empty — so the read-back verification itself must run sandbox-off.
3. Only tell the user it's copied after the grep confirms the new content is on the clipboard.

## Why it matters

A silently-stale clipboard reads as success. Pick a token that changed between the old and new content (a version, a path segment, a unique flag value) so the grep actually distinguishes them — grepping for something common to both proves nothing.
