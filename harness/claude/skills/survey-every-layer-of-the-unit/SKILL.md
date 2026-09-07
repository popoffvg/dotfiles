---
name: survey-every-layer-of-the-unit
description: Use when asked how an API, pattern, or convention is used across a codebase's repeated units — "find the X query and what blocks usually ask for", "how do our plugins call Y", "survey Z usage across the packages", "I need a use cases report", "is that the common practice?", "do other <units> do it this way?". Forces enumerating each unit's internal layers (model/, workflow/, ui/, schema/) before surveying, so the layer that actually executes the call is not missed, and forces counting at the call site with a structure-aware parse rather than a fixed-window grep.
metadata:
  origin: self-improvement
---

# Survey every layer of the unit, not just the first one found

Before grepping for the API, list one unit's directory tree and decide which layers can
contain the API under study. Survey each such layer. Report per layer.

A survey that stops at the first layer where the API appears looks complete — same
vocabulary, same call shapes, plenty of citations — while omitting the layer that runs
the call. The gap is invisible from inside the finished report.

## Procedure

1. `ls <one-unit>/` and `ls <one-unit>/*/src` — get the real layer list.
2. For each layer, decide: can the API under study appear here? Different language is not
   evidence of absence — the same concept is often re-expressed per layer.
3. Grep each candidate layer separately. Count call sites **per layer**; the counts differ
   and the difference is a finding.
4. State the layer split in the report before the details, and label which layer each
   citation comes from.

## Count the sites, and name the unit you counted

"Is this the common practice?" is a question about **sites**, not about units. A unit-level
count answers a different question and reads as if it answered this one: *29 of 80 repos
mention the key* says the convention is rare, while *45 of 57 sites that use it use it exactly
this way* says the shape is the norm. Both are true. Only the second answers whether the code
being written matches its neighbours.

So report both when they diverge, and lead with the site count. A single count invites the
reader to draw the conclusion the other one contradicts.

## A fixed-window grep miscounts a nested construct

`grep -A6 'domain: {'` sweeps in whatever follows the block — the annotations map, the next
field — and those keys land in the tally as if they were inside it. The output looks like a
measurement and is not one; the wrong keys are usually the *most frequent* ones, so they top
the ranking.

When the thing being counted is a brace-, bracket-, or tag-delimited body, match the delimiter
and extract the body. Write it as a small reusable script rather than an inline one-liner, and
sanity-check one known site by hand against the script's output before quoting any number.

## Distinguish read from write

In a layer that both queries and emits specs, a raw grep for the vocabulary conflates the
two. Constrain the pattern to the call site — the selector body passed to the query
function — and verify a sample of the excluded hits are genuinely assignments. Reporting
written names as queried names inverts the ranking.

## Platforma blocks (`~/git/mil/1_blocks`)

Two layers, both required:

| Layer | Path | Role |
|---|---|---|
| Model | `<block>/model/src/*.ts` | Discovery. Builds dropdown options. Fetches no data. |
| Workflow | `<block>/workflow/src/*.tpl.tengo` | Resolves the picked column **and its data** for the computation. |

The p-frame query exists in both, with the same `AnchoredPColumnSelector` shape:
`ctx.resultPool.getOptions` / `getAnchoredPColumns` / `getCanonicalOptions` in the model;
`wf.createPBundleBuilder()` with `addAnchor` / `addSingle` / `addMulti` in the workflow.
A model-only survey misses where the query executes. Some blocks also have `ui/`.

If the layout differs from this table, trust step 1 over the table.
