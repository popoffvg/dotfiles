---
name: handoff
description: Handoff — read the conversation, decide whether the next session implements or researches, and write the matching handoff document for a fresh agent. Use on "handoff", "hand this over", "write a handoff", or before a session ends with work left.
argument-hint: "What will the next session be used for?"
---

# handoff — pick the next mode, then write its document

The next session runs in one of two modes, and each mode gets its own document:

- **implementation** — the plan is settled. The next session edits code, config, or docs.
- **research** — an unknown blocks the first edit. The next session finds facts, and the handoff document carries the findings so far as a report.

1. Read the whole conversation. List the decisions made, the files changed, the commits, the commands run with their results, and the questions still open. If the user passed arguments, treat them as the focus of the next session. Done when every open question names what it blocks.
2. Pick the mode with this table. The first row that matches wins. Done when the mode and a one-sentence reason exist.

   | Condition | Mode |
   |---|---|
   | The user's arguments name the mode | that mode |
   | An open question blocks the first edit, or the conversation ended in an investigation | research |
   | The goal, the files to change, and the acceptance check are known | implementation |
   | None of the rows above | research |

3. Resolve the path. The slug is the goal in 2–4 kebab-case words, for example `flaky-ci-test`. Strip the trailing slash from `$TMPDIR` (macOS leaves one):
   ```bash
   T="${TMPDIR:-/tmp}" && DIR="${T%/}/claude-handoff" && mkdir -p "$DIR" && ls "$DIR" && echo "$DIR/<slug>.md"
   ```
   If `<slug>.md` exists, read it and merge the new facts into its sections. Done when the absolute path is known.
4. Write the document with the `Write` tool to the absolute path. The `Write` tool does not expand `$TMPDIR`. Use the structure of the mode below. Done when every required section is present.
5. Reply with the mode, its reason, and the absolute path.

## Rules for both modes

- A handoff document MUST open with `Mode: implementation` or `Mode: research` and the one-sentence reason.
- A handoff document MUST reference each commit, PR, plan, ADR, or diff that exists by path or URL. It MUST NOT restate their content.
- A handoff document MUST end with **Suggested skills**: the skills from the session skill list that the next steps need, or `none`.

## Implementation document

- **Goal** — what the next session ships, and the check that proves it.
- **State** — what is done and what is in progress, by file path and commit.
- **Next steps** — the concrete first actions, in order.
- **Risks** — what can break, and the open questions that do not block the first edit.

## Research document

- **Question** — the question the research answers, and the decision the answer serves.
- **Findings** — one row per confirmed fact: the claim and its source. A source is a `file:line`, a config value, a command with its output, or a URL. A claim with no source is labeled `assumption` with its basis.
- **Ruled out** — each hypothesis the conversation rejected, and the evidence. A negative finding MUST name its positive control: the same query run against something known to exist. A rejection with no positive control goes to Open questions.
- **Open questions** — each untested hypothesis and each unanswered question, with the next query to run and where to run it.
- **Recommendation** — the mode the session after the research takes: implement (with the change it makes) or research more (with the reason).
