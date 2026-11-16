---
name: lessons
description: >-
  Prepare a dependency-ordered course from a document corpus, rewrite existing
  vault lessons in place, or adapt a course to Bloop's Markdown reader. Includes
  sourced teaching and application questions. Self-improvement scan reports use
  self-improvement:lessons.
argument-hint: "[corpus or existing course, optionally quiz or lessons only]"
---

# Prepare courses and lessons

Write sourced Markdown that helps the learner explain and apply an idea.

## Procedure

1. **Choose the owner and output.** Use the requested course and destination.
   For an existing vault course, read its index, lesson notes, and learning records.
   Use the vault connector for discovery. For Bloop, read the target checkout's
   lesson resource documentation, decoder, and renderer before choosing fields.
   Codebase teaching through `/code teach` keeps the teach skill's workspace and
   output format; this skill supplies pedagogy. Done when the source course,
   destination, and supported rendering contract are identified.
2. **Read the corpus.** Inventory the source files; read the canonical units behind
   summaries, including their decisions, status, and open questions. Identify the
   learner's starting understanding, desired capability, and existing self-checks.
   Done when the lessons can trace their claims to evidence rather than one summary.
3. **Order the concepts.** Build dependencies before linearizing the course. Open
   with the problem, introduce prerequisites before use, and finish with limits.
   Keep already learned concepts distinct from planned lessons. Use
   [curriculum guidance](references/curriculum.md) for anatomy and sequencing.
   Done when each lesson uses only established or newly explained terms.
4. **Teach a consequence.** Give each lesson one useful outcome, a prediction,
   an explanation, a worked case, and a new case to apply. Define terms at first
   use. Prioritize traps, rejected alternatives, and differences that change a
   decision. Distinguish hypothetical practice from reported events. Preserve
   uncertainties; verify questionable technical claims against primary sources.
   Done when the reader can predict or choose something using the lesson.
5. **Prepare checks.** Reuse the corpus's self-checks. Use cases and claims to
   judge, with plausible distractors and explanations for correct, incorrect,
   and uncertain answers. Read [quiz guidance](references/quiz.md) when preparing
   an assessment. Open responses remain self-assessed unless a grader exists.
   Done when every check has a supported answer and teaches the reason.
6. **Write in the destination's format.** Default to Markdown with source links.
   For vault notes and Bloop, follow the Markdown delivery rules below. A requested
   HTML artifact or `/code teach` uses that owner's presentation rules instead.
   Presentation instructions in the references apply only when the destination
   supports them. Done when the actual consumer can read the written resources.
7. **Show the result.** Review the rewritten course and open a representative
   lesson in the real reader when available. Check the edited resource and question
   formats with existing project checks. Report paths, actual checks, and limits.
   Reading or answering a page establishes participation, not lasting understanding.

## Markdown delivery

- **Vault in place:** Keep original course and lesson paths, identities, links,
  interviews, answers, state, and learning history. Rewrite instructional material
  in the Markdown body. Preserve the existing Check and provenance. Move teaching
  out of `lesson_html`; retain a recoverable original before removing that field.
  Reconcile corrected claims in the course index as well as its lesson. Use an edit
  capability or the authorized local sync copy; `add_note` creates another note.
- **Bloop export:** Vault frontmatter and Bloop resource metadata are separate
  formats. Follow the checkout's existing `metadata.yaml` and `content.md` layout,
  supported API version, names, and ordered lesson list. Exporting files does not
  establish a live vault connection or import historical progress.
- **Fragments:** Use ordinary Markdown, fenced Mermaid for useful mechanisms,
  and the existing versioned `question` JSON format for interactive choices.
  Keep question IDs stable and unique within a lesson. The current Bloop fragment
  carries `version`, `id`, `prompt`, and `choices`; feedback belongs to the owning
  application's answer handler, keyed by course, lesson, and question. Prepare
  feedback there or label its absence; an answer field in Markdown is not a grader.
  Open practice uses prose until the reader supports an appropriate control.
- **Reader ownership:** The frontend supplies navigation, styling, and interaction.
  Course preparation supplies content and compatible metadata. Keep executable
  HTML, CSS, scripts, and invented UI controls out of Markdown lessons. Preserve
  a learner's option to pause or acknowledge uncertainty, and describe storage or
  progress only when that consumer implements it.

## Grounding

Each definition, threshold, and rationale needs a source. Label defaults as
defaults. Use the newer or more specific evidence when sources disagree, and
record the correction. Background can explain a term; new domain mechanisms
need evidence. Put source links with the lesson so the learner can verify them.
