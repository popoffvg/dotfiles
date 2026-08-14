---
name: teach
description: >
  Build and measure the human's understanding of a codebase and a branch change, step by step
  across sessions. Owns the stateful workspace `<notes-dir>/teach/` — the mission, the numbered HTML
  lessons, the reference sheets, the learning records that set the level of the next session — and
  the graded quiz that checks what landed. Read-only over project source. Load it when the `code`
  skill routes to teach or quiz, or when asked to teach, onboard, quiz, or walk a person through
  this codebase.
user-invocable: false
---

# teach — build the human's understanding

The `code` skill routes here; it holds no teaching procedure of its own.

> **Map**: `wm:INDEX.md` — which skill owns which file, and what that file owns.
> **Vocabulary**: `wm:GLOSSARY.md` — the leading words all four skills use verbatim.

| Piece | Holds | File |
|---|---|---|
| The loop | Subject selection by spec `status`, the mission gate, knowledge vs skills vs wisdom, lesson delivery, the learning record. | `commands/sub-teach.md` |
| The check | `quiz` — a multiple-choice quiz over the spec (`status` `init`/`review`) or the code changes (`status` `impl`), graded, scored. Read-only; edits no artifact. `teach` builds the understanding, `quiz` measures it. | `commands/sub-quiz.md` |
| `MISSION.md` | Why the human is learning this code. Every lesson traces back to it. | `references/tpl-teach-mission.md` |
| `RESOURCES.md` | The trusted sources — the code first, external docs second. | `references/tpl-teach-resources.md` |
| `learning-records/NNNN-*.md` | What the human understood in one session, and the level the next one starts at. | `references/tpl-teach-learning-record.md` |

## What stays elsewhere

Lesson **content** — dependency order, the concept-per-step rule, alternatives and asymmetries —
belongs to the `lessons` skill. This skill owns the workspace, not the pedagogy. Everything else it
reads is mapped in `wm:INDEX.md`.
