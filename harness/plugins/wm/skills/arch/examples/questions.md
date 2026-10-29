> Copy to `<notes-dir>/QUESTIONS.md` and delete every `>` block. One `## <slug>` section per open question. The format is `arch:ref-adr-format.md` § An open question is a section of QUESTIONS.md.

# Open questions

> The spec is not ready while this file has a section: `~/.claude/scripts/wm-open-questions.sh <notes-dir>` exits 1. A strategic answer becomes an ADR, written with the `adr` skill after the operator approves it. A tactical answer — a package location, a name, a value — lands where it applies: `spec.md`, the TODO, or `PATTERNS.md`. Then the section is deleted.

## refresh-race

**Question:** What happens when two refreshes race on the same expired refresh token?
**Blocks:** The refresh handler and its error contract for clients.
**Options:**
- A — The second refresh returns 409, and the client retries with the new token (recommended: the race is under 0.01% of traffic).
- B — A single-flight lock in Redis makes the second refresh wait for the first.
- C — Both refreshes succeed and issue two token pairs.

## resume-upload-id-reason

**Question:** Why does a resumed upload continue the open upload of a stable upload id, and not start a new upload?
**Blocks:** The ADR on resumable uploads. The operator chose A in the grill and gave no reason.
**Options:**
- A — A stable upload id lets a caller resume after a restart without sending the stored parts again (recommended: it is what `transferctl` does today).
- B — Every write starts a new upload; a restart sends the whole file again.

> A decision the operator made without a reason is a question too: "Why A over B?". It stays here until the operator gives the reason.
