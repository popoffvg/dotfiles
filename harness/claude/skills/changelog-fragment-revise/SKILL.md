---
name: changelog-fragment-revise
description: Use when adding a changelog fragment/entry (changie .changes/unreleased, towncrier newsfragments, or similar per-change files) for work that revises, supersedes, or corrects behavior introduced by an EARLIER STILL-UNRELEASED entry in the same branch/release. Triggers when about to write a `Changed`/`Removed` fragment for something a sibling `Added` fragment in the same unreleased batch already describes.
---

# Revise the prior unreleased fragment, don't stack a Changed

When a change modifies behavior that an earlier fragment in the SAME unreleased batch introduced (both files still under `unreleased/`, neither in a released version yet), edit that prior fragment to describe the final shipped behavior. Do NOT add a second `Changed`/`Removed` fragment revising it.

## Why

- Both fragments ship in the *same* release. "Added X" + "Changed X" in one release notes is self-contradictory — the reader never saw the intermediate X.
- Bump semantics punish it: `Added`→minor, `Changed`/`Removed`→major (changie `.changie.yaml`; towncrier similar). A `Changed` over never-released behavior forces a spurious **major** bump for a net-new feature.
- `Changed`/`Removed`/`Deprecated`/`Fixed` describe deltas against an **already-released** version. Behavior that only ever existed on this branch has no released baseline to change.

## Do

1. Find the sibling unreleased fragment describing the behavior (`grep` the feature name across `unreleased/`).
2. Edit its `body` to state the final behavior; keep its `kind` (usually `Added`) and `time`.
3. Delete the fragment you were about to add (or just skip creating it).
4. Net result: one accurate `Added` fragment for the feature.

## When a separate fragment IS correct

The prior entry is already in a released version (not under `unreleased/`, or shipped in a tagged release). Then `Changed`/`Removed` against that baseline is right — that's exactly what those kinds are for.
