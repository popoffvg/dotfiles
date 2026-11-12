---
name: gist
description: Write a change-review document of the change this session made or planned, and publish it as a private GitHub gist. Use when the user says "gist this", "share the change", "create a gist with the session info", or wants a review of the change that another person or machine can open by URL.
argument-hint: "Which change: a branch, a PR, a commit range, or nothing for this session's change"
---

Write one change-review document and publish it as a gist.

1. Pick the change. Use the argument when the user names a branch, a PR, or a commit range. Else use the change this session made or planned. If the session holds two unrelated changes, ask which one.
2. Load the `change-review` skill. Write the document for the change of step 1 to `$TMPDIR/claude-gist/<slug>.md`, where `<slug>` names the change in kebab case.
   - Code that landed: take every section from the real diff and the real commits. Write `## Deviations` when the code differs from a plan that the user approved in this session.
   - Code that does not exist yet: write the plan, and omit `## Deviations`.
3. Check the document against the `Done when` line of `change-review`. Fix each gap before you publish.
4. Create a secret gist from that file:
   ```bash
   gh gist create --desc "<title of the document>" "$TMPDIR/claude-gist/<slug>.md"
   ```
5. Print the absolute local path and the gist URL. The reader fetches it with `gh gist view <id> --raw` or `curl` on the raw URL.

If `gh auth status` fails, stop and tell the user to run `gh auth login`. Do not paste the document anywhere else.
