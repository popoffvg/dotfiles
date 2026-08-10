---
name: adr
description: Read the current session and record the architecture decisions it made as ADRs in docs/adr/. Use for "write an ADR", "record this decision", "ADR for what we just decided", after the SessionEnd ADR reminder fires, and when a session settles a hard-to-reverse choice — a technology with lock-in, an integration pattern, a context boundary, or a deliberate deviation from the obvious path.
---

# adr — turn a session into an ADR

**Read what the session decided, keep only what qualifies, draft it, and ask before writing.** An ADR records what the team decided; the team confirms the wording. Format and lifecycle live in [ADR-FORMAT.md](../domain-modeling/ADR-FORMAT.md); the file to copy is [ADR-TEMPLATE.md](../domain-modeling/ADR-TEMPLATE.md).

## 1. Collect the candidate decisions

Work from the conversation in context. When the session is long, compacted, or the reminder named a transcript, read the transcript file instead — the `SessionEnd` reminder prints its path, and a live session's path is `~/.claude/projects/<project-slug>/<session-id>.jsonl`.

A candidate is a point where the session chose one option over another and acted on it. Take the choice from what the user approved, not from what you proposed.

**Completion criterion**: each candidate has the alternative it beat and the reason it won, quoted from the session.

## 2. Drop the candidates that do not qualify

All three tests must pass, from `ADR-FORMAT.md`:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one won for specific reasons.

Most sessions produce zero ADRs. Say so and stop — an ADR for an obvious choice buries the ones that matter.

**Completion criterion**: every surviving candidate names which reading of each test it passes.

## 3. Check what is already recorded

Read `docs/adr/` and `docs/!archived/adr/` before drafting.

| Finding | Action |
|---|---|
| The decision is already recorded and unchanged | Stop. Report the file. |
| The session **reverses** a recorded decision | Draft a new ADR that names the one it supersedes, then follow the supersession steps in `ADR-FORMAT.md`. |
| The session **refines** a recorded decision | Edit that ADR: bump `updated`, append a changelog line. No new number. |
| Nothing recorded | Draft a new ADR. |

**Completion criterion**: both directories were listed, and the action above was chosen from what they hold.

## 4. Draft

Number from the highest number in **both** directories plus one. Copy `docs/adr/TEMPLATE.md` when the repo has one, otherwise `ADR-TEMPLATE.md`. Fill `created` and `updated` with today's date and open the changelog with `- <today> — Drafted.`

Keep the body to one to three sentences: the context, the decision, the reason. Add *Considered Options* or *Consequences* only when the session produced something a reader could not infer.

**Completion criterion**: the draft has frontmatter with `status: proposed`, a title, the decision paragraph, and a closing `## Changelog` section.

## 5. Ask, then write

Show the full draft and the target path. Write it only after the user approves the wording. Create `docs/adr/` with its `TEMPLATE.md` on the first ADR, and add the README *Decisions* pointer at the same time.

**Completion criterion**: the file exists at the approved path, or the user declined and nothing was written.

## The reminder

The `SessionEnd` hook `~/.claude/scripts/adr-session-end-hook.sh` fires this skill's trigger: it warns when a session discussed a decision and recorded none. **It is off by default** — a repo turns it on with `touch .claude/adr-reminder.on`, one run with `ADR_REMINDER=on`, and `ADR_REMINDER=off` overrides the marker.
