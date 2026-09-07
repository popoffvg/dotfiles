# Cases

## 2026-08-03 — Two of eight spec atoms were consequences of already-accepted atoms

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer/text`, corpus `work/projects/pframe-domain-modeling` (mispec2)
- **Task:** Drafting "round A" of a spec corpus — turning twelve decisions from a grilling interview into atoms. I produced five new atoms plus three revisions and handed all eight to the operator for review.
- **What I did:** Wrote one atom per decision taken in the interview, without checking any candidate against the atoms already on the approved surface. Two failed that check:
  - `kind-detection` — "the convention states how a kind is read; it ships no helper to read it". Derivable from the accepted `attribute-registry`, which had already fixed the package as a flat map of plain strings; a map of strings cannot contain a function, so "no helper ships" was decided when that atom landed.
  - `context-domain-excluded` — "no vocabulary goes in `contextDomain`". Same question as the accepted-in-the-same-round `spec-position`, which *is* the placement rule; a forbidden position belongs inside the rule that enumerates positions.
- **Correction:** > why are you adding that atom?
- **Evidence:** `work/atoms/524-attribute-registry.md` states the registry is one flat map of plain strings, which is what makes `kind-detection`'s claim derivable. `work/staging/540-spec-position.md` owns the "where does meaning go" question that `context-domain-excluded` also answered. The corpus's own compactness invariant states that a leftover atom "taxes every future reader", and its cost is paid per byte at every orientation.
- **Ambiguous?** no — one right answer per candidate. `kind-detection` is derivable and drops; `context-domain-excluded` answers an owned question and folds. Neither is a judgment call about scope.
- **Scope chosen:** global — row 1 of the Step 1 table. Teachable to anyone writing a modular corpus (spec atoms, ADRs, doc sections, rules files, config entries), and the test does not depend on mispec2 or on this repo.
- **Rule written:** verdict — before adding a unit, check the nearest accepted unit; if the candidate is derivable from it, drop it, and if it answers a question that unit already owns, fold it in.
- **Note on the sibling lesson from the same session:** `deliver-the-named-shape` (captured earlier the same day, same repo) covers over-producing *within* one artifact when the user named its shape. This one covers over-producing *units* in a corpus where no shape was named. Same family — adding more structure than the work earns — but different triggers, so they are separate skills rather than one.

## 2026-08-03 — A whole concept survived the design that needed it

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer/text`, corpus `work/projects/pframe-domain-modeling`
- **Task:** Same corpus, minutes after the case above. The registry design had just been simplified twice — to one flat map, then to plain strings with no subgroups — and I was still carrying the "input kind" vocabulary through the atoms.
- **What I did:** Kept building on the kind concept after every design decision that gave it a job had been reversed. The flat registry removed per-kind grouping; the family-prefix rule keyed naming on vocabulary families rather than kinds; no helper shipped, so the package never reads a kind. Nothing referenced the concept any more, and it still had a new concept atom, a decision atom, an accepted invariant named after it (`open-kind-set`), and a work-piece.
- **Correction:** > drop kind terms entirely
- **Evidence:** After the cut, six atoms and six questions stood without the term. `work/atoms/524-attribute-registry.md:25` still read "the grouping is by input kind: a common group plus one group per kind" — a sentence describing a structure two decisions had already removed.
- **Ambiguous?** no — once the registry is flat, keyed on families, with no helper, the vocabulary spec has no use for the concept. The operator also chose to delete the accepted `open-kind-set` invariant outright rather than restate it, against my recommendation to restate.
- **Scope chosen:** global — same skill, second case. Extends rather than forks: same root cause (units the work does not earn), different trigger (after a simplification, not while drafting).
- **Rule written:** added the "Re-run the test after every simplification" section — when a decision simplifies the design, walk the units that served the old shape and remove the ones now dead, in the same pass.

## 2026-08-10 — merged 11 skills into one rubric and nearly deleted detail the rubric never carried

- **Repo:** `~/git/dotfiles`
- **Source:** discovery — self-caught while executing an approved deletion step; no user statement produced it.
- **Task:** Cutting resident skill-listing cost by merging the proof-discipline cluster of captured skills into one `claim-evidence` skill, then retiring the originals.
- **What I did:** Compressed 11 SKILL.md bodies into 14 one-line table rows, set the originals to `skillOverrides: "off"`, and told the user their "payload now lives in claim-evidence". On the deletion step I diffed the survivor against each original: 8 of the 11 carried operational detail no row reproduced — the per-ecosystem stale-cache carrier table, the safe mermaid dialect rules, the PATH / `TMPDIR` / sandbox / process-lifetime table with its check commands, `claude plugin update` vs `install` plus the cache confirmation, the pprof `-peek='cgocall'` drill-down and cgroup-limit reading, the "score each option at its strongest form" section, and the "when your derived artifact caused the user's false premise" procedure. A second defect from the same haste: I had claimed `nested-claude-print-guard`'s payload was merged when only its exit-0 row was.
- **Evidence:** `~/.claude/skills` is not a git repo (the captured skills were untracked real directories, only the hand-authored ones were symlinks into the tracked tree), so `rm` would have been unrecoverable. Resolution: each body became `harness/claude/skills/claim-evidence/references/<row>.md`, and the originals with their `CASE.md` moved to `harness/claude/skills-retired/` — tracked for the first time. Listing cost still fell from 8,545 to 6,954 tokens (97 → 84 skills).
- **Ambiguous?** No — one right answer. Reading the survivor before deleting costs one diff; the detail was otherwise unrecoverable.
- **Scope chosen:** global — row 1. Merging a corpus and retiring the merged units recurs for docs, specs, ADRs, and rules files, not only skills; worth teaching a new colleague.
- **Rule written:** verdict — run the derivability test in reverse before removal, against the survivor's actual text; route what does not fit into a reference rather than dropping it; and confirm the corpus is versioned before deleting from it.
- **Transcript:** not archived — captured live, mid-session.
- **Session topic:** auditing the self-learned skill corpus and replacing skills with cheaper harness containers.

## 2026-08-10 — copied the fixup mechanics into a consuming file whose owner file already stated them

- **Repo:** `~/git/dotfiles`
- **Source:** correction — the operator pushed back on the body of a rule I had just written.
- **Task:** Landing "use `git commit --fixup` when an increment exists because the user corrected a shown diff" into the `wm` plugin's `code` skill. The increment-approval loop (`harness/plugins/wm/skills/code/commands/sub-impl.md` step 5.4) said every approved increment is appended with `git commit --amend --no-edit`, so a correction inside the loop was amended away and never reached the fixup trail that `squash` reads.
- **What I did:** Wrote the rule into step 5.4 *with its mechanics inline* — the exception clause plus `git commit --fixup=<sha-of-commit-it-corrects>` plus "never amended away" plus the pointer. The command string already lived in three other files.
- **User's words:** > How we can use DRY things
- **Evidence:** `harness/plugins/wm/skills/code/CLAUDE.md` § "Single source of truth" names `commands/sub-commit.md` as the owner of commits and states other refs "point to it instead of restating". The `git commit --fixup=<sha>` line was already at `sub-commit.md:28`, `harness/plugins/wm/agents/implementer.md:37`, and `harness/plugins/wm/skills/code/references/fix.md:132`. `references/ref-subcommand-rules.md:19` is the model of the correct shape: one line, "fixups on correction. See `sub-commit.md`."
- **Ambiguous?** no — the corpus declares an owner for this rule in its own `CLAUDE.md`, so the consuming file states the branch and cites. The other branch is right only where no owner exists yet, and then the fix is to create one, not to inline.
- **Scope chosen:** global — row 1 of the Step 1 table. Any multi-file doc corpus with a declared owner per rule hits this; the situation recurs well past this repo, and nothing in the rule depends on `wm` or on git.
- **Rule written:** extended with the section "A candidate that is only partly new — keep the new clause, cite the rest" — strike every sentence a reader could get by following the citation; what is left is the unit.
- **Note:** the first two failure modes in this skill delete the whole candidate. This one keeps the candidate and cuts its body, which is why it needed its own section rather than a clause on `Same question`.
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-unit-must-not-be-derivable-2940aae3-e3da-43c5-8d28-6f9dec9bb82c.jsonl`
- **Session topic:** Integrate fixup instruction in toto implementation

## 2026-08-10 — An optional config field written out as a copy of the field its default is derived from

- **Repo:** ~/git/mil/tasks/MILAB-6679-developability-designer (block `1_blocks/antibody-variant-designer`)
- **Source:** correction — the operator said the field looked redundant and asked me to verify it against the schema rather than assert either way
- **Task:** Writing the PColumn spec builder for a Platforma block. Each `xsv.importFile` column entry was emitted as `{column, id, spec}`, with `id` set to the same string as `column` for all 15 columns.
- **What I did:** Copied the `{column, id, spec}` triple from the sibling block (`1_blocks/3D-Structure-Based-Liabilities/workflow/src/specs.lib.tengo`) and justified `id` in a comment as "set to the same string so the map key and the file header cannot drift apart" — which is backwards: writing it is what allows the drift.
- **User's words:** > The one thing that genuinely looks redundant is `id` repeating `column` — that pairing comes from the precedent block, and whether `xsv.importFile` would default `id` from `column` if omitted is something I have not verified against `PFCONV_IMPORT_CFG_SCHEMA`. you tell me that.
- **Evidence:** `platforma/sdk/workflow-tengo/src/pframes/util.lib.tengo:118` declares the field `` `id,?` `` — optional — with the documented default "column label with all special characters replaced with `_`", and `xsvColumnId(c)` at `:281-287` returns `c.column` when `c.id` is undefined. Every header here is alphanumeric, so the default resolves to exactly the string I was writing. Dropped `id`; the PFrame map key is unchanged and the tests that key on it still pass.
- **Ambiguous?** no — one right answer once the schema is read. The only case for writing it is a header needing special-character replacement, where the default would differ from the desired id.
- **Scope chosen:** global — "an optional field whose default is derived from a field you already set is a derivable unit" holds for any schema-backed config, and the misleading neighbour-file precedent is the general trap.
- **Rule written:** verdict — extended `unit-must-not-be-derivable` with a section applying the derivability test to a config entry's own fields, where the implying unit is the schema's documented default; check the schema's optional marker and its fallback resolver, not the neighbouring file that spells the field out.
- **Transcript:** /Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-deliver-the-named-shape-72ab8ad4-b77e-4aaf-81a6-0ed2296b3ff5.jsonl
- **Session topic:** Antibody variant designer — the emitted PColumn specs and the synthesis CSV column set
