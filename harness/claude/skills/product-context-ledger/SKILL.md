---
name: product-context-ledger
description: >-
  Set up a product repository's context ledger: product intent, architecture
  decisions, concepts, evidence, and scoped rules. Use when bootstrapping these
  documents or reconciling scattered project notes into a maintained corpus.
user-invocable: false
---
# Set up a product context ledger

Adapt the ledger to the product; Bloop supplies the pattern, not another product's requirements or stack.

## Procedure

1. **Find the owners.** Read repository instructions, product documents, architecture notes, manifests, and existing context directories, including ignored notes. Inspect version-control boundaries before changing them. Reuse established paths and preserve unrelated work. Record which files own each subject in the artifact map below.

2. **Establish the baseline.** Read the current product and architecture material, relevant decisions, concepts, rules, and source evidence. Separate intended outcomes, accepted decisions, proposals, observed implementation, and executed verification. Follow explicit supersession links within their scope. A later date alone does not settle a contradiction. Record unresolved conflicts and their affected work in the questions file. This step ends when every setup claim has a source or an explicit unknown status.

3. **Write product intent.** Populate the product owners in the artifact map. Add capability notes only where separate user outcomes or ownership justify them. Distinguish activity counts from evidence of user value. Ask for missing product choices that block the setup while continuing supported sections. Record nonblocking gaps as questions; stop dependent work only when the missing choice changes its scope or correctness.

4. **Write architecture and concepts.** Populate their owners in the artifact map, including dependency boundaries and state ownership. Explain how the structure supports product outcomes. Trace consequential architecture decisions to decision records. This step ends when each boundary has an owner and each decision has a status and a sourced rationale or a linked question.

5. **Derive scoped rules.** Give each rule a descriptive slug, applicability, observable requirement, source decision, and verification method. Derive enforceable rules from accepted constraints; label candidate rules from proposals as proposed. Code verification remains separate from decision authority. Separate architectural constraints from operator workflow preferences. Record workflow choices only when the user or repository supplies them. Reuse existing linters and boundary checks for deterministic rules. Configure semantic review only if that system already exists or setup explicitly includes it. Keep credentials and operator model settings outside repository policy.

6. **Connect the corpus.** Add a short reading order and maintenance pointers to the repository's existing agent instructions. Link canonical owners instead of copying their rules. Create a context index only when existing entry points cannot supply that map. Keep feature notes scoped and link their parent policy. Mark superseded material at its old entry point and link the replacement. Keep TODOs and execution history separate from enduring product and architecture context.

7. **Verify the setup.** Check every internal link, cited path, rule source, and stated implementation status. Run the repository's applicable documentation and rule-configuration checks. Confirm the existing entry point reaches product intent, architecture, concepts, and rules. Resolve each contradiction or leave an explicit question naming the blocked work. Report changed files, actual checks, remaining unknowns, and the entry point for future work.

## Artifact map

Use existing equivalents first. These are candidate paths to create, not dependencies to read from this skill's directory. Create only files with supported content; a small repository can combine roles under clear headings.

| Role | Candidate owner | Content boundary |
| --- | --- | --- |
| Product direction | `MISSION.md` | Audience, problem, promise, outcomes, decision principles |
| Capability intent | `product/<capability>.md` | User value, scope, hypotheses, evidence, validation |
| Architecture | `ARCHITECTURE.md` | Current and target ownership, contracts, failure and delivery boundaries |
| Vocabulary | `GLOSSARY.md` | Canonical term, meaning, status, code identifier if present, retired names, source |
| Concept explanation | `.notes/CONCEPTS.md` | Relationships, ownership, flows, and states; diagrams when useful |
| Decisions | `.notes/adr/` | Decision status, rationale, alternatives, consequences, checkable properties, supersession |
| Reuse | `.notes/PATTERNS.md` | Existing implementation or library, source location, fit and limits |
| Evidence | `.notes/research/INDEX.md` | Source links, inspection date, supported claims, uncertainty |
| Open decisions | `.notes/QUESTIONS.md` | Question slug, options, evidence, affected work, resolution when known |
| Review constraints | Existing rule directory or `.notes/rules/` | Scoped rules derived from decisions, with verification methods |
| Workflow choices | `.notes/RULES.md` | Confirmed planning, testing, approval, and commit preferences |
| Reading order | Existing `AGENTS.md` or `CLAUDE.md` | Entry points and conditions for loading specialized context |

## Boundaries that preserve meaning

- **Status:** Source inspection proves code exists; a passing command proves only the behavior it checks. Design notes and acceptance cases do not establish implementation or deployment.
- **Scope:** A feature revision supersedes only the behavior it names. A backend target does not silently replace a frontend delivery constraint.
- **Reuse:** Inspect workspace solutions before proposing infrastructure. Record alternatives, code avoided, compatibility, and dated maintenance evidence when selecting a library. Repository setup alone requires no application dependency.
- **Storage:** Preserve existing tracking and nested repositories. Keep shareable policy in the product repository's established documentation area. Confirm storage intent before introducing an ignored or separately versioned ledger. Keep private source material and secrets out of generated public documents.
- **Extent:** This skill sets up context. It does not authorize application scaffolding, migration, installation of review services, commits, or deployment.
