---
name: newcomer-teaching-material
description: Use when the user says they are new to a domain ("I'm a newcomer", "I'm totally nooby", "no background in X") and asks for study material — lessons, a course, an explainer, a concept walkthrough, onboarding for an unfamiliar spec or codebase. Ensures every domain term is defined where it is used instead of assumed.
metadata:
  origin: self-improvement
---

# Teaching material for a self-declared newcomer

A newcomer cannot look up what they cannot name. In explanatory prose, **one unexplained
term ends comprehension for the whole paragraph** — the reader stops learning and starts
guessing. So the deliverable is not "an explanation of the topic"; it is "an explanation
that never spends a term it has not paid for".

## Rules

**Define every domain term at first use.** Not just the exotic ones — the ones an insider
reads without noticing are the dangerous ones. Sweep your own draft for nouns a beginner
could not define. The categories to sweep for, with examples from one domain:

- the field's everyday words (`residue`, `motif`, `clonotype`)
- units and notations (`Å`, regex shorthand, `log-space`, matrix indexing)
- near-synonyms the reader must keep apart (antigen / epitope / paratope)
- file formats, tool names, and platform jargon

**Define in place, or link — never assume.** If the definition fits the sentence, inline
it. If explaining it fully would break the narrative, link to a full entry and give the
one-line gist on hover/in parentheses so the reader does not have to leave the sentence.

**Backlink both directions.** Each glossary entry lists every lesson that uses the term,
marking where it is introduced; each lesson lists the terms it introduces. This lets the
reader enter from either side — from a word they hit, or from a lesson they are studying.
In HTML, derive both directions **programmatically at load** from the actual links; never
hand-maintain the lists, and never state a term count you did not compute.

**Distinguish terms that get confused.** When a subject has several similar-shaped
quantities, say explicitly what each one is *about* and repeat that separation where they
co-occur. Naming the confusion is teaching; listing the definitions is not.

**Carry one concrete metaphor — and choose it from this subject.** Map the subject's parts
onto one everyday system once, then return to that same mapping in every section instead of
inventing a fresh analogy per concept. Give each glossary term both a plain definition and
its reading in the metaphor, and say plainly that the metaphor is a teaching device, not the
subject's own language.

Derive the metaphor per topic. Never carry over the one that worked in your last piece of
teaching material — a default metaphor flattens whatever does not fit it. To choose:

1. List the subject's load-bearing *relations*: what flows through what, what constrains
   what, what gets rejected and by whom, what is measured versus assumed.
2. Pick the mundane system that shares those relations — not one that merely shares
   vocabulary. Sequential stages with inspection gates suggest a production line; naming,
   lookup and collision suggest a library or postal system; competing constraints resolved
   by a rule suggest a court or an auction; expensive-then-cached work suggests a kitchen
   with prep stations.
3. Test it on the subject's *hardest* part before committing. A metaphor that cannot express
   that part will quietly lie exactly where the reader most needs the truth.

Abandon a metaphor when you need a second one for a single section, or when the mapping
inverts — the metaphor's cheap thing is the subject's expensive one.

**Build up, never sideways.** Order sections so each uses only vocabulary the previous ones
established. If a section needs a term from later, that ordering is wrong.

**Ship the self-check with the material, not beside it.** A course and its quiz belong in one
artifact. Give every section its own question block, linked from that section and linking
back, so a reader can test one lesson without hunting; add a final round for the questions
that cross section boundaries. A wrong answer should name where to re-read. Prefer questions
that hand over a case and ask what happens, or state a plausible-sounding claim and ask the
reader to judge it, over questions that ask for a definition back.

**Check the answer-key distribution before shipping.** Authoring left to right clusters
correct answers on one option letter, and a reader who notices can score without knowing
anything. Count the keys and rebalance — and when you move an option, re-read every
explanation that names option letters, since the swap silently invalidates them.

**Let the reader get back.** Any jump away from the narrative — a term, a glossary entry, a
question — needs a way back to the exact place they left, not just the top of a section.
Breadcrumbs that name the current position, plus a back affordance that restores scroll
position, turn a reference lookup into a detour instead of an exit.

## Verify before delivering

Re-read as the beginner: for each paragraph, is every noun either defined here, defined
earlier, or linked? Grep your own draft for the field's jargon and confirm each hit
resolves. For an HTML deliverable, check every term link has a target and every target is
reachable.
