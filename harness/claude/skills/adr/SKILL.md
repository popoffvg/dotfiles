---
name: adr
description: Read the current session and record the architecture decisions and the application features it settled as ADRs, each with the Properties a reviewer checks code against. Use for "write an ADR", "record this decision", "ADR for what we just decided", after the SessionEnd ADR reminder fires, and when a session settles a hard-to-reverse choice — the main components and their layering, a platform or technology with lock-in (Cloud Run or Infrastructure Manager, Terraform), where state lives, a trust or process boundary, a deliberate deviation from the obvious path, or a user-visible feature contract such as a `--dry-run` mode that shows the changes and applies none.
---

# adr — turn a session into an ADR

**Read what the session decided, keep only the main architecture decisions and feature contracts, take each reason from the operator, and ask before writing.** An ADR records what the operator decided; the agent finds it, the operator owns it. Format and lifecycle live in [ADR-FORMAT.md](../domain-modeling/ADR-FORMAT.md); the file to copy is [ADR-TEMPLATE.md](../domain-modeling/ADR-TEMPLATE.md).

**Where ADRs land:**

| Project | Live ADRs | Archived ADRs |
|---|---|---|
| A wm project — it has a `.notes/` notes dir | `.notes/adr/` | `.notes/adr/archived/` |
| Any other repo | `docs/adr/` | `docs/!archived/adr/` |

`.notes/` is its own jj repo, so in a wm project move an archived ADR with `mv`, not `git mv`, and skip the README *Decisions* pointer.

## 1. Collect the candidate decisions

Work from the conversation in context. When the session is long, compacted, or the reminder named a transcript, read the transcript file instead — the `SessionEnd` reminder prints its path, and a live session's path is `~/.claude/projects/<project-slug>/<session-id>.jsonl`. Also read the grill files and decision notes the session wrote.

A candidate is a point where the session chose one option over another and acted on it. Take the choice from what the operator said or approved, not from what you proposed.

**Completion criterion**: each candidate has the decision and the session line it comes from.

## 2. Keep only the main decisions

An ADR has one of two kinds, set in the `kind` frontmatter key:

| Kind | Records | Properties a reviewer checks |
|---|---|---|
| `architecture` | How the system is built: components, platform, state, boundaries. | What the code must do or must never do inside. |
| `feature` | What the user can do and what the user sees: a command, a mode, an output contract. | What the user observes — each one an E2E check. |

Sort each candidate into one kind, then run that kind's tests.

### Architecture tests

A candidate is an architecture ADR only when all four tests pass:

1. **System-wide** — it shapes more than one component or more than one TODO. A choice inside one package or one TODO is an implementation detail.
2. **Hard to reverse** — changing it later costs a migration, a rewrite, or a broken install.
3. **A real trade-off** — a competent engineer would defend at least one alternative.
4. **The operator's choice** — the operator made it or approved it. An agent's choice that nobody approved is a candidate for step 4, not an ADR.

What passes: the main components and their layering; a platform or technology with lock-in (run Terraform in Cloud Run, not in Infrastructure Manager; use Terraform at all); where state and secrets live; a trust or process boundary (no cloud SDK, every cloud call is a CLI); a deliberate deviation from the obvious path.

What fails: a name, a field, a file layout, a function signature, a log format, an error text, a test fixture, a CI step, a value such as a timeout, a scope cut of one TODO. A value or a rule that follows from an ADR becomes a **Property** of that ADR, not a new ADR.

### Feature tests

A candidate is a feature ADR only when all three tests pass:

1. **User-visible** — the user starts it or sees its result: a command, a mode flag, an output, a prompt, an exit code.
2. **A promise** — a user or a script depends on it, so a change to it breaks them.
3. **The operator's choice** — the operator asked for it or approved it.

What passes: `deploy --dry-run` shows every change and applies none; `sync` asks before it deletes a file; `status --json` prints one stable schema; a failed run leaves the target as it was.

What fails: a flag that only tunes a value, a help text, a color, the order of log lines, an internal option no user sets. A detail of a recorded feature becomes a **Property** of that feature ADR, not a new ADR.

Most sessions produce zero ADRs. Say so and stop. A project holds about ten live architecture ADRs; a count far above that means implementation details got in. Feature ADRs grow with the product, one per user-facing contract.

**Completion criterion**: every surviving candidate names its kind and the reading of each test it passes.

## 3. Merge into what is already recorded

Read both ADR directories before drafting.

| Finding | Action |
|---|---|
| Recorded and unchanged | Stop. Report the file. |
| The session adds a rule that follows from a recorded ADR | Add a Property to that ADR: bump `updated`, append a changelog line. No new number. |
| The session **refines** a recorded decision | Edit that ADR the same way. |
| The session **reverses** a recorded decision | Draft a new ADR that names the one it supersedes, then follow the supersession steps in `ADR-FORMAT.md`. |
| Nothing recorded | Draft a new ADR. |

**Completion criterion**: both directories were listed, and each candidate has one action from the table.

## 4. Find the blind spots and interview the operator

Fill five slots per candidate from the session alone: **Decision**, **Alternatives** (at least one real one, with why it lost), **Reason**, **Properties**, **Consequences**. A slot is a blind spot when no session source fills it:

- **Reason** — the operator never said why, or only you said why. A reason you inferred is a blind spot, however sure you are.
- **Alternatives** — no rejected option is named, or one is named without the reason it lost.
- **Properties** — the session never states what must stay true while the decision holds.
- **Consequences** — what this makes harder, and what fact would make the operator reverse it.

Settle a slot from a source when one exists, as `grilling` step 2 says, and cite it. Interview the operator on what stays open with the `grilling` skill, one round in `grill-adr-<subject>.md`. Each blind spot is one `[decide]` block, at most five per round, root decisions first:

| Blind spot | Ask | Option A (recommended) |
|---|---|---|
| Reason | "Why X over Y?" | The reason the context points to, marked as your guess, quoting what points to it. |
| Alternatives | "What else did you consider, and why did it lose?" | The obvious alternative, with the loss reason you infer. |
| Properties | "While X holds, what must never happen?" — for a feature: "What does the user see, and what must the feature never do?" | Two to four invariants you can check in code or with one E2E run, each one line. |
| Consequences | "What would make you reverse X?" | The fact that breaks the reason. |

An empty Answer slot means the operator accepted the recommendation; record that reason as `(accepted recommendation)`. A candidate whose Reason the operator will not give stays `proposed`.

**Completion criterion**: every slot of every candidate is filled from a cited session source or from an answered grill block.

## 5. Draft

Number from the highest number in **both** directories plus one. Copy `TEMPLATE.md` from the ADR directory when the repo has one, otherwise `ADR-TEMPLATE.md`. Fill `kind`, fill `created` and `updated` with today's date, and open the changelog with `- <today> — Drafted.`

Write the decision paragraph in one to three sentences. Quote the operator's reason. List each Property as `P1.`, `P2.`, … — one invariant a reviewer can check against a diff, cited as `ADR-NNNN/P2`. A Property says what the code must do or must never do; it names no file, no ticket, no plan.

A feature ADR is titled with what the user does, such as "Dry-run shows the changes and applies none". Its paragraph says who uses the feature, how they start it, and what they get. Its Properties say what the user observes, for example:

- P1. `deploy --dry-run` prints every create, update, and delete that `deploy` would make.
- P2. `deploy --dry-run` changes no resource and writes no state.
- P3. `deploy --dry-run` exits non-zero when `deploy` would fail.

**Completion criterion**: the draft has frontmatter with `status: proposed` and a `kind`, a title, the decision paragraph, a quoted reason, at least one Property, and a closing `## Changelog` section.

## 6. Ask, then write

Show the full draft and the target path. Write it only after the operator approves the wording; approval sets `status: accepted`. Create the ADR directory with its `TEMPLATE.md` on the first ADR, and add the README *Decisions* pointer at the same time.

**Completion criterion**: the file exists at the approved path, or the operator declined and nothing was written.

## The reminder

The `SessionEnd` hook `~/.claude/scripts/adr-session-end-hook.sh` fires this skill's trigger: it warns when a session discussed a decision and recorded none. **It is off by default** — a repo turns it on with `touch .claude/adr-reminder.on`, one run with `ADR_REMINDER=on`, and `ADR_REMINDER=off` overrides the marker.
