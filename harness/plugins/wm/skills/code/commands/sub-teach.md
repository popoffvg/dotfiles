# code — teach (the human learns this codebase)

Teach **the human** the current codebase and the change on the branch, step by step, across many
sessions. Stateful: the teaching workspace under `<notes-dir>/teach/` carries what the human already
knows from one session to the next, so each session starts at the right level instead of at the
beginning. Read-only over project source. Vocabulary: `../GLOSSARY.md`. Spec contract + `status`:
`ref-write.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

Sibling, not a duplicate: `quiz` measures understanding in one pass and scores it; `teach` builds
the understanding over time and records it. A missed quiz question is an input to the next lesson.

## Workspace

```
<notes-dir>/teach/
├── MISSION.md            # why the human is learning this code (template: tpl-teach-mission.md)
├── RESOURCES.md          # trusted sources — the code first, external docs second (template: tpl-teach-resources.md)
├── NOTES.md              # the human's teaching preferences and working notes
├── learning-records/     # NNNN-slug.md — what is now known, and why it changes what to teach next
│                         #   (template: tpl-teach-learning-record.md)
├── lessons/              # NNNN-slug.html — one lesson per file, the unit of teaching
├── reference/            # *.html — compressed cheat sheets the human returns to
└── assets/               # components shared across lessons — stylesheet, quiz widget, diagram helpers
```

Create each directory lazily, on the first file that needs it. `MISSION.md` is the exception — it
comes first, before any lesson.

**One glossary, not two.** The workspace has no glossary of its own: the project's ubiquitous
language lives in `<notes-dir>/GLOSSARY.md` (`tpl-glossary.md`), and every lesson uses those terms
verbatim. A term the human learns and can use correctly belongs there — add it in the same commit,
per `ref-subcommand-rules.md` § Glossary.

## Pick the subject from the phase

Read `spec.md` frontmatter `status` (spec phase `init → review → impl`). Arg overrides:
`/code teach code`, `/code teach diff`, or `/code teach <path-or-symbol>`.

| `status` (or arg) | Subject | Source of truth |
|---|---|---|
| `init` / `review` | **the codebase the change lands in** | the files the ledger touches, `spec.md` (Goal, Plan), `thoughts/`, `GLOSSARY.md` |
| `impl` / `diff` | **the change on the branch** | `git diff <target>...HEAD` + the implemented `todos/TODO-N.md` (Outcome, Constraints, Changes) |
| `<path-or-symbol>` | **that unit** | the file or symbol, plus its callers and callees |

No `spec.md` and no diff → ask which path or symbol to teach, and stop until answered.

## The mission comes first

Every lesson traces back to the mission — the reason the human wants to hold this code in their
head. Ship it? Review it? Extend it next quarter? Take it over from someone leaving?

`MISSION.md` missing or unclear → interview the human before writing anything else, then write it
per `tpl-teach-mission.md`. Teaching without a mission produces lessons that cover the code and
teach nothing, because nothing decides what to leave out.

A mission may shift as the human learns. Confirm the shift with the human, update `MISSION.md`, and
write a learning record that captures the change.

## Zone of proximal development

Each lesson must challenge the human just enough. Fix the level before writing:

1. Read `learning-records/` — that is the floor of what is already known.
2. Read `NOTES.md` for stated preferences and prior experience.
3. From the mission, pick the most relevant thing that sits one step above the floor.

An explicit request from the human overrides the calculation.

## Knowledge, skills, wisdom

Three things build deep understanding of a codebase, and each has a different source:

- **Knowledge** — what the code is and why it is that way. Draw it from the repo and from
  `thoughts/`, never from parametric guesses about how such systems usually work. Every claim in a
  lesson carries a `file:line` citation, or the thought note id that decided it.
- **Skills** — being able to act in the code: trace a call, place a change, predict what a test
  covers. Built by making the human do it, with immediate feedback.
- **Wisdom** — knowing which of several correct options this team would pick. It lives with the
  people who wrote the code and in the project's review history, not in a lesson. Answer as far as
  the repo supports, then name who or which PR trail to ask.

**Difficulty is the enemy for knowledge and the tool for skills.** Acquiring a fact should be easy —
difficulty eats the working memory needed to understand it. Making the fact durable should be hard —
effortful retrieval is what builds retention.

Split retention from recall on purpose:

- **Fluency strength** — retrieval in the moment. It feels like mastery and is not.
- **Storage strength** — retention over weeks. This is the goal.

Build storage strength with desirable difficulty: retrieval practice (recall from memory, closed
book), spacing (revisit an earlier lesson's core fact in a later lesson), and interleaving (mix two
related subsystems in one skills exercise).

## Lessons

A lesson is one self-contained HTML file, `lessons/NNNN-<dash-case-name>.html`, teaching one
tightly-scoped thing tied to the mission. Scan `lessons/` for the highest number and increment.

Keep it short — completable in one sitting, within working memory, delivering one tangible win the
next lesson can build on.

Content, ordering, and the four content types worth including (consequences, traps, rejected
alternatives, asymmetries) are owned by the `lessons` skill (`skill:lessons`) — load it and follow
it. This file does not restate them. What `teach` adds on top:

- **Cite the repo, not prose.** Every mechanism claim links a `file:line`; every design claim links
  its `thoughts/` note. A lesson about this codebase that cites nothing is invented.
- **Point at one primary source** the human should read themselves — the real file, not a summary.
- **Link out via HTML anchors** to earlier lessons and to `reference/` documents.
- **End with the invitation to ask.** The agent is the teacher; anything unclear is a follow-up
  question, not a dead end.
- **Close the feedback loop inside the page** where the skill is mechanical — a quiz or a small
  in-browser task that grades itself the moment it is answered. For quizzes, make every option the
  same length in words, and in characters where possible; formatting must leak no clue.
- **Send the human into the repo** where the skill is not mechanical — a numbered list of real steps
  to run (trace this call, break this test, find this caller), then grade what they report back.

Rendering: single self-contained HTML file, inline `<style>` and `<svg>`, no external fetch,
theme-aware. Diagram encoding rules are the `/dive explain` guide's
(`../../dive/references/arch-diff-diagram-guide.html`). Open the lesson after writing and verify it
renders — load the `visual-artifact-verify` skill; the correctness is visual.

## Assets

Reuse is the default. Read `assets/` before authoring a lesson and build from the components
already there. Something new that a second lesson could reuse goes into `assets/` and is linked,
never inlined.

The shared stylesheet is the first component the workspace earns — every lesson links it, so the set
reads as one course rather than a pile of one-offs.

## Reference documents

Lessons are rarely reread; reference documents are. Write the compressed essence of a lesson to
`reference/<slug>.html`, in a shape built for a five-second lookup and for printing.

What earns a reference document here: the module map, the call-flow of the core path, the invariants
a change must not break, the commands to run the tests, the shape of a `PColumn`-style domain
structure the code passes around.

## Learning records

Write `learning-records/NNNN-<slug>.md` per `tpl-teach-learning-record.md` when the human
demonstrates real understanding of something non-trivial, discloses prior knowledge, has a
misconception corrected, or shifts the mission. Coverage is not learning — wait for evidence.

Records are the input to the next session's level calculation, so they state what changes about what
to teach next, not what happened.

## NOTES.md

Record the human's stated teaching preferences and anything to keep in mind — pace, format, topics
to skip, the language they think in. Read it before designing a lesson.
