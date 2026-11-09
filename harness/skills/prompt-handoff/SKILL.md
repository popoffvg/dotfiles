---
name: prompt-handoff
description: Write the session context to `.notes/handoff.prompt` so the Zed inline assistant can write the next prompt from it. The Ctrl+G buffer shows the file below the draft. Use on `/prompt-handoff`, or before the operator writes the next prompt in Zed.
---

# prompt-handoff — the session context for the inline assistant

The reader is the Zed inline assistant. It reads no file, runs no tool, and sees only the Ctrl+G buffer. Every fact it needs MUST be in the file as text.

1. Collect the facts from the conversation. For Files and Last result, also read `git diff` and `git status` of the repo. Done when each heading below has its facts, or has none in either source.
   - **Goal** — what the session works toward, and the operator's why. When the conversation does not give the why, write `why: unknown`. Do not invent one.
   - **Decisions** — each choice made, with its reason. Also each approach the operator rejected.
   - **Terms** — each name the session made or uses in its own sense, with a gloss of at most 8 words.
   - **Files** — each path the session changed or will change, and in one line what changed in it.
   - **Last result** — what the last turn did, and what failed or is untested.
   - **Open** — each open question, and the next step the session expects.
2. Run `mkdir -p "$(git rev-parse --show-toplevel)/.notes"`, then overwrite `.notes/handoff.prompt` in that root. Use the six headings above as `## Goal` to `## Open`, in that order, with `-` bullets under them. Drop a heading with no facts, except `## Goal`. Keep the whole file under 250 words. Leave out the tool output, the steps already done, and the chat history.
3. Reply with the path and the word count of the file.
