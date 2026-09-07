# Cases

## 2026-08-10 — A word-overlap cutoff ranked good comments alongside the paraphrases it was built to catch

- **Repo:** `/Users/vitaliipopov/git/dotfiles` (the gate), reading `/Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer` (the corpus it was tested against)
- **Source:** discovery — an experiment while building the gate, no user statement produced it
- **Task:** The user asked how to force a DRY policy on comments, after finding that comments in `specs.lib.tengo` repeated the code. Chose a PostToolUse hook plus a review dimension, then had to make the hook safe to wire.
- **What I did:** The first design scored a comment by how much of its vocabulary appeared in the code under it, and flagged anything above a cutoff. Checked that design against real comments in the target file before writing it: `// Nullable: a residue type absent from the Ala-X-Ala reference table has no relative SASA at all, and that must not read as "buried"` names `rsasa`, `residue` and `nullable` — every word the code spells — and would have been flagged. So would the comment explaining that `json.encode` iterates a Tengo map in Go's randomised order. Both are the exact comments the rule exists to protect.
- **User's words:** > comment double the code meanings. It's violate dry policy. How we can force better comment
- **Evidence:** After adding the causal-word exemption, the gate over the real 429-line `specs.lib.tengo` returned exactly two findings, both `* @param blockId: string`, and left the neighbouring `* @param clonotypeAxisSpec: object - the parent axis, taken from the upstream…` alone. A four-comment Go fixture flagged `// Increment the retry counter.` and `// Set the user email on the profile.` at 100%, and passed a Retry-After assumption comment and a nullability comment. Overlap alone had ranked all four together.
- **Ambiguous?** no — a score with no class feature cannot separate classes that share vocabulary. The sub-decision inside it (widen the 3-line window to reach a distant function name, or route that class to the diff-reading reviewer) resolved one way: widening raises the false-positive rate on every doc block to catch one class.
- **Scope chosen:** global — row 1 of the Step 1 table. The situation is any quality gate over text: lint rules, duplicate detectors, commit-message checks. Nothing in it is specific to this repo, this language, or the hook API.
- **Rule written:** verdict — find the feature only the acceptable class carries before picking a cutoff; exempt on the feature, rank on the score; test the class the gate must **not** flag.
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-dry-policy-hooks-299442a7-034f-4602-a098-7a6000145a55.jsonl`
- **Session topic:** Enforce DRY policy for Claude output
