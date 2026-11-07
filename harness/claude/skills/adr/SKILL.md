---
name: adr
user-invocable: false
description: Read the current session and record only the global decisions it settled as ADRs, each with the Properties a reviewer checks code against. Use for "write an ADR", "record this decision", "ADR for what we just decided", after the SessionEnd ADR reminder fires, and when a session settles a hard-to-reverse choice — the main components and their layering, a platform or technology with lock-in (Cloud Run or Infrastructure Manager, Terraform), where state lives, a trust or process boundary, a deliberate deviation from the obvious path, or a product-wide contract such as every command having a `--dry-run` mode that shows the changes and applies none.
---

# adr — turn a session into an ADR

**Read what the session decided, keep only the global decisions — the ones every later change must obey — take each reason from the operator, and ask before writing.** An ADR records what the operator decided; the agent finds it, the operator owns it. Format and lifecycle live in [ADR-FORMAT.md](../domain-modeling/ADR-FORMAT.md); the file to copy is [ADR-TEMPLATE.md](../domain-modeling/ADR-TEMPLATE.md).

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

## 2. Keep only the global decisions

**An ADR records a global decision only.** A decision is global when a later change in another component, another TODO, or another feature must obey it. A decision that shapes one step, one tool, one command, or one pipeline is tactical. It goes where step 2b says, never into an ADR.

An ADR has one of two kinds, set in the `kind` frontmatter key:

| Kind | Records | Properties a reviewer checks |
|---|---|---|
| `architecture` | How the system is built: components, platform, state, boundaries. | Guarantees observable at the system boundary. |
| `feature` | What the user can do and what the user sees: a command, a mode, an output contract. | Guarantees observable by the user. |

Sort each candidate into one kind, then run that kind's tests.

### Architecture tests

A candidate is an architecture ADR only when all four tests pass:

1. **System-wide** — it shapes more than one component or more than one TODO. A choice inside one package or one TODO is an implementation detail.
2. **Hard to reverse** — changing it later costs a migration, a rewrite, or a broken install.
3. **A real trade-off** — a competent engineer would defend at least one alternative.
4. **The operator's choice** — the operator made it or approved it. An agent's choice that nobody approved is a candidate for step 4, not an ADR.

What passes: the main components and their layering; a platform or technology with lock-in (run Terraform in Cloud Run, not in Infrastructure Manager; use Terraform at all); where state and secrets live; a trust or process boundary (no cloud SDK, every cloud call is a CLI); a deliberate deviation from the obvious path.

What fails: a name, a field, a file layout, a function signature, a log format, an error text, a test fixture, a CI step, a value such as a timeout, a scope cut of one TODO. Route a value or rule through the tactical decision table below.

### Feature tests

A candidate is a feature ADR only when all four tests pass:

1. **Product-wide** — the contract binds every command, every output, or every surface, not one of them.
2. **User-visible** — the user starts it or sees its result: a command, a mode flag, an output, a prompt, an exit code.
3. **A promise** — a user or a script depends on it, so a change to it breaks them.
4. **The operator's choice** — the operator asked for it or approved it.

What passes: every command that changes state has a `--dry-run` that applies nothing; every destructive command asks first; every command prints one stable `--json` schema; a failed run leaves the target as it was.

What fails: one command's flag, one output's layout, one reply's shape, one provider's fallback order, a help text, a color, the order of log lines, an internal option no user sets. Route a detail of a recorded feature through the tactical decision table below.

Most sessions produce zero ADRs. Say so and stop. A project holds about ten live ADRs of both kinds together. A count far above that means tactical decisions got in.

### 2b. Where a tactical decision goes

| Tactical decision | Home |
|---|---|
| A rule or value that follows from a recorded ADR | A Property only after passing the Property gate; otherwise the spec, TODO, or patterns file |
| A shape the project repeats across steps — a fallback chain, a retry rule, a delivery format | The project's pattern skill in `.claude/skills/`, one rule per shape. Create the skill when the repo has none. |
| A choice inside one TODO or one feature | The spec or the TODO, beside the code it shapes |
| A fact the code shows | Nowhere — the code is its home |

**Completion criterion**: every surviving candidate names its kind and the reading of each test it passes, and every dropped candidate names its home from the 2b table.

## 3. Merge into what is already recorded

Read both ADR directories before drafting.

| Finding | Action |
|---|---|
| Recorded and unchanged | Stop. Report the file. |
| The session adds a rule that follows from a recorded ADR | Run the Property gate. Add a passing guarantee to that ADR; route a mechanism through the tactical decision table. Bump `updated` and append a changelog line when editing. |
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
| Properties | "What can a caller, user, or operator always count on while X holds?" | Two to four candidate guarantees for the [Property gate](../domain-modeling/ADR-FORMAT.md#property-gate). |
| Consequences | "What would make you reverse X?" | The fact that breaks the reason. |

An empty Answer slot means the operator accepted the recommendation; record that reason as `(accepted recommendation)`. A candidate whose Reason the operator will not give stays `proposed`.

**Completion criterion**: every slot of every candidate is filled from a cited session source or from an answered grill block.

## 5. Draft

Number from the highest number in **both** directories plus one. Copy `TEMPLATE.md` from the ADR directory when the repo has one, otherwise `ADR-TEMPLATE.md`. Fill `kind`, fill `created` and `updated` with today's date, and open the changelog with `- <today> — Drafted.`

**Title the ADR with the properties the decision gives the system, not with the option it picked.** A decision often gives more than one property; name each one, joined with "and", up to three. A title property is a general quality — reproducible, auditable, reversible, isolated, offline-capable, safe to retry. The option goes in the paragraph. The file slug comes from the title.

| Bad title — names the option | Good title — names the properties |
|---|---|
| Use an event log for orders | Order history is complete and replayable |
| Move the build into containers | Builds are reproducible and isolated from the host |
| Add a confirmation step | Destructive actions are explicit and reversible |
| Cache responses on disk | The tool works offline and starts fast |

Test the title: when it starts with a verb of choice (use, add, move, store, switch to) or names a tool or a product, it names the option. Rewrite it.

**Each title property is backed by at least one Property below.** The title says the quality in general; the Properties make it checkable. "Builds are reproducible and isolated from the host" needs, for example, "P1. Identical declared build inputs produce identical artifact digests" for reproducible and "P2. A build reads no file outside its context" for isolated. A title property with no Property under it gets one, or leaves the title.

Write the decision paragraph and Reason using `ADR-FORMAT.md`. Before filling the Properties table, run its [Property gate](../domain-modeling/ADR-FORMAT.md#property-gate) for every candidate. Show the gate worksheet with the draft; keep only the plain guarantees in the ADR.

A feature ADR title names what the user can count on everywhere, such as "Every change is previewable and side-effect free". Its paragraph says who uses the contract, how they start it, and what they get. Its candidate Properties say what the user observes. Qualify their conditions through the gate before accepting them:

- P1. Every command that changes state accepts `--dry-run` and prints every create, update, and delete it would make.
- P2. A `--dry-run` run changes no resource and writes no state.
- P3. A `--dry-run` run exits non-zero when validation of the requested changes fails.

**Completion criterion**: the draft follows the template and backs each title quality with a Property. The draft has at most 6 Properties, aiming for 4 ([Properties](../domain-modeling/ADR-FORMAT.md#properties)). Every Property has a passing gate worksheet row with observables, assumptions, a theorem statement, and a counterexample. Rewrite or move each failed candidate before showing the draft.

## 6. Ask, then write

Show the full draft and the target path. Write it only after the operator approves the wording; the operator sets `status: approved`. Create the ADR directory with its `TEMPLATE.md` on the first ADR, and add the README *Decisions* pointer at the same time.

**Completion criterion**: the file exists at the approved path, or the operator declined and nothing was written.

## The reminder

The `SessionEnd` hook `~/.claude/scripts/adr-session-end-hook.sh` fires this skill's trigger: it warns when a session discussed a decision and recorded none. **It is off by default** — a repo turns it on with `touch .claude/adr-reminder.on`, one run with `ADR_REMINDER=on`, and `ADR_REMINDER=off` overrides the marker.
