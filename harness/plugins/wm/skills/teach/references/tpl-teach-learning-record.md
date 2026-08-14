---
status: active              # active | superseded by LR-0007 — only when a later record contradicts this one
---

# Ivan reads the result pool as a cache, not a log

> This file is a filled learning record. Copy it to
> `<notes-dir>/teach/learning-records/NNNN-<slug>.md` — `0001-…`, `0002-…`, created on the first
> record — replace the content, and delete every `>` line.
> Number by scanning the directory for the highest and adding one.
> A record is the teaching counterpart of a `thoughts/` decision note: it captures the non-obvious
> lesson, the key insight, or the disclosed prior knowledge that steers the next session. Together
> the records are the level calculation — the floor of what is already known.

Ivan believed the result pool keeps every past render, so he expected a workflow re-run to be free. Tracing one re-render showed him it holds only the current entries and re-computes the rest. He now predicts which steps re-run, which means the next session can go straight to the caching rules instead of re-teaching the pool.

> One paragraph is a complete record: what was learned or established, and why it changes what to
> teach next. The value is recording *that* this is known and *why* it moves the level.
>
> Write a record when one of these holds:
> 1. The human demonstrated genuine understanding of something non-trivial — evidence they can use
>    the concept, not that it was covered. This sets a new floor.
> 2. The human disclosed prior knowledge — "I already know X". Record it and the depth claimed, so
>    later sessions do not re-teach it.
> 3. A misconception was corrected. The highest-value kind: it predicts where they will stumble on
>    related code.
> 4. The mission shifted from what was learned. Link `[[MISSION.md]]` and update it.
>
> Do not write one for material merely covered — coverage is not learning, so wait for evidence.
> Do not restate a term already in `<notes-dir>/GLOSSARY.md`. Do not keep a session activity log;
> records are decision-grade insights, not a journal.

## Evidence

Asked to predict the output of a second `mise run workflow:render`, Ivan named the three steps that would re-run and the one that would not, before the command was executed.

> How the human showed the understanding: a quiz answer, a call traced, a prediction that held,
> prior experience cited. Include it when the claim may be revisited later. Most records need no
> optional section at all — add one only when it carries real value.

## Implications

Caching rules are now teachable directly. The storage layer under the pool stays out of scope per `[[MISSION.md]]`.

> What this unlocks or rules out for later lessons, when that is not already obvious.

> **Supersede, never delete.** A later record that contradicts this one sets `status: superseded by
> LR-NNNN` here. How the understanding evolved is itself signal for what to teach next.
