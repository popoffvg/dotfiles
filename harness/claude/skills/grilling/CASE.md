# Cases behind `grilling`

## 2026-08-08 — a grill question spent on internal orphan-handling semantics

- **Repo:** `/Users/popoffvg/Documents/git/dotfiles`
- **Source:** method — the operator stated who should settle that class of branch
- **Task:** grilling a plan for a Zed extension plus language server that puts review comments on markdown lines; 17 branches were being walked one at a time with a recommended answer each
- **What I did:** asked the operator, as branch 13 of 17, what the server should do with a comment whose anchor hash no longer matches — keep and mark orphaned and still export, keep and exclude from the export, or drop it. Three options with tradeoffs, all invisible to the operator except in an edge case, and all reversible in a few lines of the server.
- **User's words:** > claude should make decision by his own
- **Evidence:** none — the operator simply declined the branch. Contrast with the same session's branch on the comment store's anchor field, where the operator overrode my recommendation with "instead of text use hash" — that branch changed the data written to disk and was theirs.
- **Ambiguous?** yes — the other branch is right when the option changes what the operator sees, types, or installs, when reversing it costs real work, or when it is taste. Those still go to the operator; this rule only covers branches whose options differ in internal behaviour alone.
- **Scope chosen:** global — the situation is any grill/interview session on any codebase, and the rule stays useful; teachable to a new colleague running a design interview.
- **Rule written:** check — added to `grilling`: a branch differing only in internal behaviour (recovery default, fallback on a missed lookup, sort order, whether a degraded record is still reported) is mine to pick, stating the pick and reason in one line; a "you decide" answer means take that branch's siblings too.
- **Transcript:** `~/.claude/self-improvement/lessons/2026-08-08-grill-decide-internal-branches-3ad31073-9fe4-4200-8d2d-be1ac5311ab1.jsonl`
- **Session topic:** 2026-08-08T20:36:59.581Z (sidecar carries a timestamp, no title)
