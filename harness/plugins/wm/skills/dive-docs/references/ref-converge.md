# Convergence loop (autonomous)

A single fan-out misses two things: a **wrong/incomplete entry-point set** (a path nobody was told
to explore) and **uncovered edge cases** (the failure path step left thin). The loop closes both. It
runs autonomously — no user in the loop — and is the explore analogue of `grill-me`'s relentless
questioning: keep probing until nothing new surfaces.

Maintain `seen` = set of explored entry-point slugs, and `dry` = count of consecutive rounds with no
new gap. Loop:

1. **Grade every artifact.** Spawn one `explore-critic` per `<ep-slug>.md`, all in one message. Each returns its `GAPS` and `NEW ENTRY POINTS` lists. What counts as a gap is the critic's own contract — `explore-critic.md` and `ref-artifact.md` hold it, so do not restate the criteria in the prompt.
2. **Filter the new entry points.** Drop the ones already in `seen` and the ones outside task scope. **Log every drop** with a one-line reason.
3. **If no fresh gaps and no new entry points:** `dry++`. Else `dry = 0`.
4. **Stop when `dry >= 2`** (two consecutive clean rounds) or after **4 rounds total** — whichever comes first. Log the stop reason and any still-open gaps.
5. **Otherwise re-spawn** a parallel round, again one message:
   - For each gapped artifact: an `explorer` briefed with that critic's gap list. It **edits the existing `.md` in place**, not a rewrite.
   - For each new in-scope entry point: a fresh `explorer` with its `<ep-slug>.questions.md` (generate that first, per `ref-grill.md`). Add the slug to `seen`.

   Then return to step 1.

Log each round: `round N — <k> gaps, <m> new entry points, dry=<d>`. Never silently cap — if you
stop at the 4-round limit with open gaps, print them.
