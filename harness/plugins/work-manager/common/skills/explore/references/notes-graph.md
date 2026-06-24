# Explore › notes-graph — graph the spec & notes

`/explore notes-graph [--notes-dir <path>]` — build a graph of the wm notes
(`spec.md`, `todos/`, `research/`) showing how they reference each other, then
**commit and push** the artifact.

## Purpose

Map the planning context as a graph so the team sees which TODO depends on which
spec section and which research anchor (`DP-N`, `EC-N`) feeds each TODO. Output
is a single Mermaid graph in markdown — renders in GitHub/editors, no build step.

## Inputs

`<notes-dir>` (default `.notes/`, resolved as in `SKILL.md` › Output location).
`--notes-dir <path>` overrides.

## Procedure

1. **Resolve `<notes-dir>`.** Bail with a message if it has no `spec.md` and no
   `todos/`.
2. **Collect nodes** by scanning:
   - `spec.md` → one node per top-level section heading.
   - `todos/TODO-N.md` → one node per TODO.
   - `research/<ep-slug>.md` → one node per file; sub-nodes per `DP-N` / `EC-N`
     anchor referenced elsewhere.
   - `worklog.md`, `plan.md` if present.
3. **Collect edges** by grepping references (use `fff grep` / `multi_grep`):
   - TODO **Pre-reads** pointing at `research/<ep>.md#DP-N` / `#EC-N`.
   - TODO → spec section references.
   - `research/INDEX.md` → each `research/<ep>.md`.
   - Any `TODO-N` mention inside another doc.
   Label each edge with the relationship (`pre-read`, `implements`, `depends-on`).
4. **Write** `<notes-dir>/notes-graph.md`:

   ```markdown
   # Spec & notes graph

   _Generated from `<notes-dir>` at <commit>._

   ```mermaid
   graph LR
     spec["spec.md"]
     TODO1["TODO-1: …"]
     R_auth["research/auth.md"]
     R_auth_DP1["auth.md#DP-1"]
     TODO1 -->|pre-read| R_auth_DP1
     R_auth_DP1 -.-> R_auth
     TODO1 -->|implements| spec
   ```

   ## Legend
   | Edge | Meaning |
   |---|---|
   | `pre-read` | TODO cites this research anchor |
   | `implements` | TODO realizes this spec section |
   | `depends-on` | TODO ordering dependency |
   ```

   Group `DP-N`/`EC-N` sub-nodes under their file with a `subgraph`. Keep node
   ids alphanumeric (`mermaid` rejects `/`, `.`, `#` — slugify).
5. **Commit and push:**

   ```bash
   git add "$NOTES_DIR/notes-graph.md"
   git commit -m "explore: notes-graph for $(basename "$NOTES_DIR")"
   git push
   ```

   If not on a branch / no upstream, create one first (`git switch -c notes-graph-<topic>`)
   then `git push -u origin HEAD`. Never commit to the default branch directly.

## Update / re-render

Re-run — it overwrites `notes-graph.md` in place and commits the refresh.

## Limits

- Sweet spot: ≤ 40 nodes. Beyond that the Mermaid layout sprawls — split per
  TODO or render with `flow-map` instead.
- Edges are only as good as the references in the notes; an unlinked TODO shows
  as an isolated node (useful signal).
