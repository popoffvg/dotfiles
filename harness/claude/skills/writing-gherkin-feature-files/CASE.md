## 2026-08-11 — Fixing gherkin-lint findings in the antibody-variant-designer spec

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer` (also touched `~/git/mil/pl-perf-4214` by mistake, see below)
- **Source:** correction + method — user corrected a wrong-repo detour, then gave two explicit style rules
- **Task:** set up gherkin-lint for `.feature` files and fix its findings
- **What I did:**
  1. Searched `~/git/mil` for `*.feature` with `find . -iname "*.feature" | head -20`; the 20-line cutoff was filled entirely by duplicate files in `pl-perf-4214`/`pl.review` (alphabetically before `tasks/`), so I set up and fixed lint in the wrong repo before the user pointed at `.notes/features/variant-design-run.feature:15` in the actual project.
  2. Wrapped long step text across two physical lines with indentation and no keyword — gherkin-lint's `no-multiline-steps` rejected every one; joined them into single lines.
  3. Several scenarios mixed two independent checks in one scenario (`Then` followed later by a second `When`) — `keywords-in-logical-order` rejected these; split each into two scenarios.
  4. User then said "don't use ' symbol" — rewrote every possessive (`the block's trace`) to `of`-phrasing (`the trace of the block`).
- **User's words:**
  > looks like the file is broken (about "Undefined step" markers — turned out to be normal Cucumber-extension behavior for a spec with no glue code, not a real bug)
  > don't use ' symbol
- **Evidence:** `npx --yes gherkin-lint` output before/after each fix; `grep -n "'" *.feature` returning empty after the apostrophe pass.
- **Ambiguous?** no — one right answer for each of the four rules.
- **Scope chosen:** global — the teachability test passes: these are Gherkin-authoring rules, not tied to this repo's content, and would be taught to anyone writing `.feature` files.
- **Rule written:** verdict — the four Gherkin-authoring rules in `SKILL.md`. The search-scope-discipline lesson from the wrong-repo detour is unrelated to `.feature` editing (it is a general working-method rule, not a Gherkin rule) and was filed separately by the triage subagent as `lesson-scope-discipline-check-current-first.md` in project memory — not duplicated here, per one-lesson-one-trigger.
- **Transcript:** not yet archived at time of writing.
- **Session topic:** Antibody Variant Designer block — TODO-3 implementation and spec review.
