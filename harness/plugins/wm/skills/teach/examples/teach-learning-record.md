---
status: active              # active | superseded by 0007 — only when a later record contradicts this one
---

# Ivan reads the result pool as a cache, not a log

> A filled learning record. Copy the file, replace the content, delete the `>` lines — each one
> states the rules for the piece above it. It is saved as
> `<notes-dir>/teach/learning-records/NNNN-<slug>.md` — `0001-…` on the first record, then the
> highest number in the directory plus one.
> Learning-record eligibility and its role in the next session are `teach:commands/sub-teach.md`
> § Learning records.

Ivan believed the result pool keeps every past render, so he expected a workflow re-run to be free. Tracing one re-render showed him it holds only the current entries and re-computes the rest. He now predicts which steps re-run, which means the next session can go straight to the caching rules instead of re-teaching the pool.

> One paragraph records the learning and how it changes the next lesson. Record rules:
> `teach:commands/sub-teach.md` § Learning records.

## Evidence

Asked to predict the output of a second `mise run workflow:render`, Ivan named the three steps that would re-run and the one that would not, before the command was executed.

> Evidence makes a revisitable learning claim checkable.

## Implications

Caching rules are now teachable directly. The storage layer under the pool stays out of scope per `[[MISSION.md]]`.

> State what this unlocks or rules out. A later contradictory record supersedes this one by number.
