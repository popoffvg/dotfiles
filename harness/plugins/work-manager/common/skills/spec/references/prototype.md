# spec — prototype

A prototype is **not** an implementation. It is the smallest visible code change that lets the user judge a design decision by reading the diff.

## CRITICAL RULES

- A prototype touches **real code** in the real repo. No scratch directories, no `/tmp` mock-ups.
- The prototype **does not run**: no `go build`, no linters, no tests, no codegen (`go generate`, proto regen), no commits.
- The diff is the artefact. The user reads the diff to decide.
- Default scope: **≤ 4 files touched**. If the implementer must go beyond, they stop and report instead of spreading the change.
- Compile breaks at the prototype's edges are **acceptable and expected**. The implementer leaves a `TODO(<TICKET>) prototype:` marker showing what real wiring would look like.

## When to use

- A `## Design Decisions` entry in `<notes-dir>/spec.md` is marked **OPEN** and the user wants to settle it.
- TODO bodies downstream of that decision cannot be authored honestly until the shape is known.
- The cost of "discuss longer" exceeds the cost of "spike it and read the diff".

Do **not** use this skill for production work. The output is a dirty working tree to be reviewed and discarded or hardened — never committed as-is.

## Workflow

### 1. Pin the decision

Before spawning anything, read the OPEN decision in `spec.md`. Record in `<notes-dir>/worklog.md`:

- Which decision (`D-N`) is being prototyped.
- Which of its candidate options is being tried.
- Why this option, not the others.

If a single prototype can answer multiple OPEN decisions, list them — but pick **one shape per spawn**, not "try all three at once".

### 2. Name the candidate options explicitly

In `spec.md`, each OPEN decision must list its candidates as `(a) / (b) / (c)` with one line each. Naming them like this makes user feedback unambiguous: "reject (b), do (c)".

Recommend a default; let the user override. Treat "let's try option X" as binding for this pass.

### 3. Brief the implementer in full

The implementer is a fresh agent with **no context** from the planning conversation. The prompt must contain:

- **Working dir** (absolute path).
- **Current tree state** — what previous prototype passes left behind. Instruct the implementer to `git diff` and `git status` before editing.
- **The shape being tried**, named explicitly by option letter from `spec.md`.
- **Exact files and line numbers** to touch, pulled from research notes (`<notes-dir>/research-*.md`).
- **Step-by-step changes** with code snippets where the type system is load-bearing. Paste the desired struct shape verbatim if it matters.
- **Non-goals**, listed explicitly: no build, no lint, no tests, no commits, no mock regen, ≤ N files.
- **Expected compile breaks** — name them so the implementer doesn't try to "fix" them.
- **Deliverable format** — under 250 words: `git diff --stat`, key code blocks pasted inline, list of known compile breaks with file:line.

### 4. Read the diff, not the report

The implementer's report is a navigation aid. Judge the prototype from the actual diff:

```bash
git -C <repo> diff <files-touched>
```

If report claims and diff disagree, push back or re-spawn.

### 5. Iterate on the shape, not the polish

**If the user rejects the option:**
- Capture **why** in `spec.md` Design Decisions so the rejection is permanent context.
- Pick the next option from the candidate list.
- Re-spawn the implementer. The implementer **reverts** prior prototype edits before applying the new shape — don't stack shapes on top of each other.

**If the user accepts the shape:**
- Move the decision from OPEN to resolved in `spec.md` Design Decisions (record the option chosen, the rationale, the trade-offs).
- Body the downstream TODOs via `todo`.
- The prototype branch is now reference material. The real implementation in the TODO may diverge — that's expected.

## Catching the "valid for a prototype, broken as a contract" smell

Prototypes routinely produce convenience hacks: nullable dependencies, fallback branches, fixed sentinel values, silent no-ops. Each one is a future bug surface if treated as the resolved answer.

Before recording a decision as resolved, ask:

- Is there a `nil`-tolerant dependency that production would never tolerate?
- Is there a zero-value / sentinel ambiguity (two different states that look the same)?
- Is there a silent-degradation path (misconfigured → looks like a different valid mode)?
- Is the invariant the decision was supposed to establish actually enforced, or did the prototype side-step it?

If any answer is yes, the prototype answered "is this shape expressible?" but not "is this shape correct?". Tighten the contract — usually by splitting one nullable type into two non-nullable types, by moving the invariant into the constructor (error or panic on misconfigure), or by lifting variation into a different layer — and **re-spawn before resolving the decision**.

## Anti-patterns

- **Prototype that runs `go build` / tests.** That's an implementation, not a prototype. Cut the scope.
- **Prototype that touches > 4 files.** The diff stops being readable. Re-scope: pick a thinner slice.
- **Prototype that commits.** The decision isn't resolved yet; committing pre-empts the user's review.
- **Prototype that "fixes" the compile break.** The compile break is the call-site that maps the new shape onto the old wiring; that wiring is a downstream TODO's job, not the prototype's.
- **Prototype that piles options.** Reverting between options keeps the diff a clean before/after of one shape.
- **Resolving a decision from the implementer's summary.** Read the diff.
- **`nil`-tolerant dependencies "for prototype convenience".** They downgrade contract review to vibes — the smell test above must catch these.

## Worklog discipline

After each prototype pass, append to `<notes-dir>/worklog.md`:

- Timestamp + decision ID + option letter chosen.
- Files touched.
- Known compile breaks (intentional, with file:line).
- User verdict (accept / reject / tighten + reason).

This trail lets later sessions reconstruct *why* a shape was picked — which is what the resolved Design Decision in `spec.md` should ultimately reflect.

## Skill ends

After the prototype is reviewed, control returns to:
- `spec` — to record the resolution in `spec.md` Design Decisions; or
- `todo` — to body the now-unblocked downstream TODOs.

This skill does **not** chain into either automatically. The user decides when the shape is right.
