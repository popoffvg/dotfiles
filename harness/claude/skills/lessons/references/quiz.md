# Quiz design

Detailed guidance for Step 4 of the `lessons` skill. Examples below are drawn from a real run against an antibody variant-design spec; adapt the shapes, not the content.

## The rule that governs everything

A question that can be answered by having read the glossary tests nothing. Every question either:

- hands the reader **a case to resolve** (concrete values, "what does the system do?"), or
- hands them **a claim to judge** (a plausible sentence, "what is wrong with this?").

Phrase questions the way a colleague would actually say the wrong thing. "A senior scientist argues: *that motif is common in human germline, so leave it — evolution kept it*" is a better question than "Is germline-commonness a valid triage signal?" because it reproduces the situation where the error actually occurs.

## Structure the paper in three ascending parts

| Part | Tests | Question style |
|---|---|---|
| **I — Terms from the side** | Whether definitions were absorbed as *usable* | Judge a colleague's phrasing; identify the metric's direction; draw a consequence |
| **II — Work the cases** | Whether rules can be applied | Concrete inputs, real thresholds, "trace the behaviour" |
| **III — Draw the conclusion** | Whether the reasoning was reconstructed | "Why was X rejected?" with true-but-not-the-reason distractors |
| **IV — Open response** | Whether the design can be re-derived | Free text with a model answer behind a toggle |

State the defaults the reader needs at the top of Part II ("exposed at ≥ 0.075; unreliable above 4.0 / 6.0; max edits 5"). The test is applying them, not recalling them.

## The seven archetypes

**1. Judge the claim.** A plausible sentence with one substantive error. Distractors include nitpicks that are true but not the error.

> "It runs inverse folding, which predicts how our sequence will fold." → The direction is backwards: inverse folding takes a fixed backbone and proposes sequences for it.

**2. Metric direction / naming trap.** Any metric whose name fights its polarity, or whose units surprise.

> Confidence `5.2` vs `2.1` — which residue is better predicted? (It is predicted *error* in ångströms; lower is better despite the word "confidence".)

**3. Work the case.** Concrete values; require the threshold.

> Methionine in FR2, rSASA 0.04. What does triage do, and what is the physical reason? (Below 0.075 ⇒ buried ⇒ the chemistry needs solvent ⇒ leave it.)

**4. Compute and read.** Make the reader apply an aggregation rule, then see why the rule exists.

> Variant changes two positions: tolerances 8.0 and 2.0, errors 3.0 Å and 7.0 Å. What is reported? (Mean 5.0 for tolerance, **worst** 7.0 Å for confidence — and note that averaging the errors to 5.0 would have hidden the 7.0 Å edit under the threshold.)

The payoff clause is the point. A compute question that stops at the number wastes the setup.

**5. Trace the consequence.** A change that satisfies one rule and violates another.

> Clearing `NG` by editing the +1 produces `NST` — a glycosylation sequon. Verdict? (Rejected at the constrain step: the goal requires the target cleared *and* nothing new introduced.)

**6. Name the reason, not the rule.** The correct answer states the governing reason; distractors are *true statements that are not the reason*. This is the sharpest available separator between recall and understanding, and it is the archetype to over-index on in Part III.

> Why is every output only a hypothesis? Correct: preserving the fold ≠ preserving binding to a specific epitope, and nothing checks binding. Distractor that is true but not the root: "the structure is predicted, not experimental" — true, contributes, but the gap would persist with a perfect structure. Say so in the explanation.

**7. Reconcile the tension.** Point at two rules that look contradictory.

> Nothing is hard-filtered — yet `meets_goal` is a hard filter. Reconcile. (Soft for signals expressing preference; hard for the objective's definition of success.)

## Open questions (Part IV)

Four is a good count. Shapes that work:

- **Defend a design choice to a skeptic** — "a bench scientist asks why you'd even show a High-risk variant."
- **Specify an extension** — "a PM wants property Z as a new goal; enumerate what you build *and what you must not touch*." The second clause is what tests the abstraction.
- **Argue against the cheap alternative** — "the lookup table already lists the standard fix; why involve the model at all?"
- **Reconstruct from a constraint** — "given only that the antigen is unavailable and no binding predictor is in scope, derive the design." Answer as a bulleted chain of consequences. This is the best single question in the paper; put it last and say so.

Provide a textarea, and put the model answer behind a `<details>` so the reader commits first.

## Distractor construction

- One distractor should be the **naive-but-reasonable** reading — what someone would answer after skimming.
- One should be **true but irrelevant** — a real fact from the corpus that does not answer this question.
- One may be a **plausible inversion** — the rule applied backwards, or the exception treated as the rule.
- Never include a joke or obviously wrong option. It reduces a 4-way question to a 3-way one.
- Keep option lengths comparable. A conspicuously longer correct answer is a giveaway; if the correct answer needs length, give the distractors comparable substance.

## Explanations

Reveal on answer, for right and wrong alike. An explanation should:

- state the mechanism, not just "correct";
- add the fact the question implied but did not state;
- name *why the distractor was tempting* when the distractor was a true-but-not-the-reason option;
- cross-reference the question that tests the same idea from the other side ("now hold that against Q13").

Label the verdict differently for wrong answers ("Not quite — the answer is C") and tint it differently, so the reader can scan for their own errors afterwards.

## Scoring conventions

- Score only the multiple-choice part; open questions are explicitly unscored, and say so.
- Sticky bar with answered/total, correct count, a progress track, and a reset.
- One shot per question — lock the options after the first click, reveal the correct one. Allowing retries destroys the score's meaning and the reader's own signal.
- State that scoring is page-local and resets on reload; do not persist it.

Copy `../assets/quiz-scaffold.html` rather than re-deriving this markup and script.
