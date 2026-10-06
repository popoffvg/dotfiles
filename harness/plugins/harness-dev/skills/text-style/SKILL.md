---
name: text-style
description: >
  Shape agent-facing markdown into the house style — steps plus disclosed reference, a checkable
  completion criterion per step, leading words instead of restatements, positive targets instead of
  bans, and a description that fires as a context pointer. Load it when writing or rewriting a
  SKILL.md, an agent file, a command file, a `references/` doc, or an AGENTS.md/CLAUDE.md, when the
  `prune-text` skill reaches its reshape phase, and when judging whether a file reads as the shape
  its reader needs.
user-invocable: false
---

# text-style — the shape of a file an agent runs

The output is a document written for an agent to *run*, not for a human to read: a short spine of ordered steps, reference disclosed behind pointers, and every line earning its load. Five moves, each on the whole file.

**Rank every piece on the hierarchy.** Three rungs, ordered by how immediately the agent needs the material: the **in-file step** (what it does, in order), the **in-file reference** (rules and definitions consulted on demand — a flat peer-set here is fine, not a smell), and the **disclosed reference** (a sibling file reached by a pointer, loaded only when the pointer fires). Branching decides the rung: inline what every branch needs, disclose what only some branches reach. Push too little and the top bloats; push too much and you hide what the agent needs. Where a skill is a procedure carrying heavy reference, mark the split in the text — steps under one heading first, reference after.

**Co-locate one concept.** A concept's definition, its rules, and its caveats sit under one heading. Scattering fragments one meaning across the file; the test is whether it reads like documentation written for the agent.

**Give every step a completion criterion.** The condition that says the work is done, and it must be **checkable** (can the agent tell done from not-done?) and **demanding** ("every modified model accounted for" forces legwork that "produce a change list" does not). A vague bound invites the agent to finish early with the later steps pulling at it. Sharpen the wording first — split the sequence across a real context boundary only when the bound is irreducibly fuzzy and you have watched the rush happen.

**Collapse restatements into leading words.** A **leading word** is a compact concept already in the model's pretraining that the agent thinks with while running the file — *tight*, *red*, *fog of war*. Repeat it as a token, never as a sentence, and it anchors a whole region of behavior for a few tokens. Hunt the shapes that collapse: a triad spelled out at three sites ("fast, deterministic, low-overhead" → *tight*), a sentence gesturing at one idea ("a loop you believe in" → the loop goes *red*). A coined word recruits no priors and costs its own definition; reach for a pretrained one first. A word too weak to beat the default (*be thorough*) is a no-op — the fix is a stronger word (*relentless*), not more sentences.

**Turn every ban into its positive target.** A prohibition drags the forbidden behavior into context and makes it more available, and the negation is a weak modifier the named concept overruns — the ban half-reads as an instruction. State the behavior you want ("write one-line comments") so the banned one is never spoken. Keep a prohibition only as a hard guardrail with no positive phrasing, and pair it with the target.

**Write the description last.** It is a **context pointer**: it names material the agent does not yet hold and encodes the condition for reaching it, and its wording — not its target — decides whether the skill fires. It does two jobs: say what the material is, and list the **branches** that trigger it. It costs on every turn, so it prunes harder than the body. Front-load the leading word. One trigger per branch — synonyms renaming a single branch are one branch written twice. Cut identity the body already carries.

Re-order by dependency once the moves stop: a precondition must still precede its action.
