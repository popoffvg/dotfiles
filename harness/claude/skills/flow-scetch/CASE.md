# Cases — flow-scetch

Evidence behind the rules in `SKILL.md`. Append one entry per case; never rewrite an earlier entry.

`SKILL.md` itself is hand-authored — the first entry below records only the **"Sketch before asking"**
section and the description widening that were added to it, not the original skill.

## 2026-07-30 — Opened a spec grill with four option lists instead of the pipeline

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer` (Platforma block spec, wm `/code new`)
- **Task:** User ran `/code new` with "let's specify the input, output and the UI table view". I had just
  finished reading the upstream block's column contract and a sibling block's UI, and had five design
  decisions I could not resolve from code.
- **What I did:** Called `AskUserQuestion` with four questions — sequence source, CSV mechanism, edits
  representation, structure-viewer content — each with option previews, without first writing down the
  pipeline those decisions sat in. The questions named domain artifacts (`PDB`, `pl7.app/vdj/sequence`,
  `variantKey` axis) as though shared.
- **Correction:** The user rejected the tool call, then asked:
  > what did you mean when asked me about PDB?

  and after I explained that one term:
  > describe the pipeline first
- **Evidence:** After sketching the flow as four `namespace`s with `// DECISION:` markers at the exact
  lines, a decision nobody had named surfaced immediately — `Skipped`, the three distinct ways an
  antibody yields no variants (no upstream structure / no flags survive triage / backend failed). It
  was absent from all four original questions. The sketch found it; the option lists could not.
- **Ambiguous?** No — one right answer. Sketching first strictly dominates: it costs one message and
  produces both a shared referent and a more complete decision list. The only limit is volume, so the
  rule is scoped to two-or-more decisions, or any decision on a flow not yet written down.
- **Scope chosen:** global — row 1 of the Step 1 table. "Show the flow before asking someone to choose
  inside it" is worth teaching a new colleague and recurs on any spec, design review, or migration
  plan; nothing about it is tied to this repo or to Platforma blocks.
- **Rule written:** verdict — extended `flow-scetch` with a "Sketch before asking" section (sketch →
  mark decisions at their line → table → invite correction → then ask) and widened `description` to
  fire unprompted before a batch of design questions. Also noted: define each domain term where the
  flow first uses it, cross-referencing `newcomer-teaching-material` for the same failure in prose.

## 2026-07-30 — Invented a type name the project's glossary already defined

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer` (same session as the entry above)
- **Task:** Writing the flow artifacts for the Antibody Variant Designer block — typed TS pseudocode
  describing a planned Platforma block, with a domain-types file (`_flow.entities.d.ts`).
- **What I did:** Named the type holding one detected liability occurrence `Flag`, with a field
  `kind: LiabilityKind`. Neither word comes from the project. I picked them because the spec's prose
  says "flagged liability" and "benign flags" in passing.
- **Correction:** Line-level review of the artifact:
  > .notes/research/_flow.entities.d.ts:47 bad term, how spec names it, suggest a better naming
- **Evidence:** The spec has a glossary entry for exactly this concept, in two places —
  `text/work/projects/developability-variant-designer/implementation.md:237` and `README.md:53`:
  "Liability — a spot in the sequence that risks a chemical or manufacturing problem … A liability is
  a short motif (1-3 residues), not always a single position." A second wrong name surfaced from the
  same grep: `implementation.md:192` writes "Liability **type**/severity" and `:66` "which liability
  **types** to address" — "kind" appears nowhere in the spec. `Fixability` had been right by luck
  (`:161` "fixability class"). So one review comment exposed two invented names out of three.
- **Ambiguous?** No — one right answer. The project's glossary is authoritative over prose usage,
  and CODE_STYLE.md already required naming types after domain terms; the failure was not applying
  it while authoring the very artifact that fixes the vocabulary for later TODOs.
- **Scope chosen:** global — row 1. Worth teaching anyone: check the glossary before minting a name.
  Filed as a bullet on `flow-scetch` rather than a new skill, because CODE_STYLE.md already carries
  the abstract rule and a second skill would split one trigger; what was missing was the concrete
  step (grep the glossary, cite the line in the doc comment) at the moment of writing pseudocode.
- **Rule written:** verdict — `flow-scetch` rule 11: take every type name from the project's glossary
  and cite the line; the glossary noun beats loose prose usage; where no term exists, say so rather
  than quietly minting one.

## 2026-08-04 — Put the layer in the function name, and shipped an acronym

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer` (same block, same artifact set as the
  two entries above — `.notes/research/avd-pipeline.workflow.ts`)
- **Task:** The flow sketch had a helper that execs AntiFold from the Tengo workflow layer and parses
  its per-residue CSV. User asked to read the file and check the function naming.
- **What I did:** Named that helper `runBackend`, with no namespace anywhere in the file. Used the
  acronym `pdb` throughout my own identifiers — type `PdbHandle`, local `const pdb`, params
  `pdb: { handle: string; fileName: string }` — plus single-letter helper params (`i`, `l`, `r`, `m`,
  `v`, `c`) and truncations (`errJson`, `inDir`, `outDir`, `csv`).
- **Correction:**
  > runBackend should be used. It's not a backend, it's workflow layer. YOu should use namespaces like
  > workflow.Run. And don't use acronym like pdb. Verify all naming
- **Evidence:** `.notes/GLOSSARY.md:18` already defines **Model backend** as "the pluggable model
  proposing substitutions. V0.5 = AntiFold" — the model, not the layer invoking it. So `runBackend`
  named the wrong layer *and* stole a defined term. The file's own comment (old line 134) already said
  "WHERE THIS RUNS: a PYTHON script in the block's own software package — not Tengo", i.e. the layer
  split was documented in prose while no name expressed it; it became the second namespace,
  `DesignScript`, verbatim from that comment. Also: the local `Map` built from
  `parsePerResidueError(...)` had no type, while `ConfidenceByResidue` sat unused in
  `_flow.entities.d.ts:78` — the abbreviated name (`confidence`) hid the existing type from me.
  Renaming `PdbHandle` → `StructureFile` forced three more renames on the bound component
  (`resolvePdb` → `resolveStructureFile`, `pdbAnchorSpec` → `structureFileAnchorSpec`, param `pdb`);
  `tsc -p .` exits 0 after all of it. The `pdb` occurrences that correctly survive are all foreign:
  AntiFold's `--pdb_file` flag, its CSV key `(pdb_chain, pdb_posins)`, the sibling's `parse_pdb`, and
  the upstream column string `pl7.app/structure/pdb`.
- **Ambiguous?** No — one right answer on both halves. A layer word in a function name is redundant
  when the namespace exists and wrong when it contradicts the glossary; an acronym in an identifier I
  own has no upside. The one real judgment is the boundary — an acronym stays when it is another
  system's spelling, which is why rule 13 states that exception instead of banning the string.
- **Scope chosen:** global — row 1. "Namespace the layer, verb the action; spell out your own names"
  is worth teaching any new colleague and recurs in every language, not just this repo's pseudocode.
  Extended `flow-scetch` (third case on it) rather than forking a naming skill: rule 11 already owns
  "where names come from", and these are the same trigger — naming while writing or reviewing a sketch.
- **Rule written:** verdict — `flow-scetch` rule 12 (namespace carries the layer, function carries the
  domain action; grep the glossary before using a layer/component word; a prose comment naming a layer
  is a namespace waiting to be written) and rule 13 (no acronyms/abbreviations in your own identifiers;
  keep them only as quoted external vocabulary, and rename the accessors with the type). Rule 2 widened
  from "one namespace per TODO" to one per unit, with cross-layer flows getting one namespace each.
  `description` widened to fire when asked to check naming in an existing sketch.
