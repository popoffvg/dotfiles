---
name: gist
description: Run the handoff skill and publish the resulting handoff document as a private GitHub gist. Use when the user says "gist this", "share a handoff", "create a gist with the session info", or wants a handoff another person or machine can open by URL.
argument-hint: "What will the next session be used for?"
---

Produce a handoff document and publish it as a gist.

1. Invoke the `handoff` skill with the same arguments the user passed. It writes `$TMPDIR/claude-handoff/<slug>.md` and prints the absolute path.
2. Create a secret gist from that file:
   ```bash
   gh gist create --desc "handoff: <slug>" "<absolute path from step 1>"
   ```
3. Print back to the user both the local file path and the gist URL. The next session can fetch it with `gh gist view <id> --raw` or plain `curl` on the raw URL.

If `gh` is not authenticated (`gh auth status` fails), stop and tell the user to run `gh auth login` — do not paste the handoff content anywhere else.
