# Cases

Cases this skill was abstracted from. Appended by Step 4; newest last.

## 2026-07-27 — The scope gate tested portable wording, not recurrence

- **Repo:** `~/git/dotfiles`
- **Task:** Fixing Step 1 after the operator reported that it passes too often and the whole corpus turns global.
- **What I did:** Rewrote the gate to judge the reproduction's evidence — "does the failure name one repo's paths, layout, or tooling? ≥2 repos for global, default to project on a tie." Still a test of what the lesson's text mentions.
- **Correction:** > "harness/plugins/self-improvement/skills/capture-lesson/SKILL.md:18-25 wrong critiria. The real critiria can be situatiion will meet often or useful in the future often. Could you add the rule to the lesson for student or new collegue. If yes -> global skill. If situation difinetly related to current content (files and so on) -> local skill, otherwise skip"
- **Evidence:** Both the original gate ("would this help on a different codebase?") and my replacement ("does it name repo-specific artifacts?") judge the wording. Neither asks whether the situation returns. A one-off failure with no repo-specific paths passed both gates and became a global skill that fires forever.
- **Ambiguous?** no — recurrence and teachability decide it; a rule nobody would teach is not worth a skill at any scope.
- **Scope chosen:** global — this governs how every lesson is filed, wherever `capture-lesson` runs.
- **Rule written:** verdict — teachability test with three outcomes: teachable → global, tied to this content → project, neither → **skip**. `skip` did not exist before; the gate had no way to reject a lesson.

## 2026-07-29 — Capture only fired on corrections, not on methods the user stated

- **Repo:** `~/git/dotfiles`
- **Source:** method — Step 0
- **Task:** Improving the `capture-lesson` skill itself.
- **What I did:** The skill's `description`, the Step-1 flow, the `CASE.md` template (`Correction:`), and the Stop hook all keyed on one source: "the user corrected your behavior". A session where the user explained how to build a presentation — without anything being wrong — produced no skill, because there was no correction to abstract.
- **User's words:** > "let's improve self improvemnt prompt. I want to capture the way how user suggest doing thing. For example last session about presentation I suggested how claude should do it. Selve evolve should capture it"
- **Evidence:** `hooks/self-improve-stop.sh` reason text before the change: "If the user corrected your behavior in a generalizable way this session…". A stated method never matches that condition, so the hook stayed silent.
- **Ambiguous?** no — a method the user states is a lesson; the only judgment left is the existing scope gate.
- **Scope chosen:** global — governs every capture run, in any repo.
- **Rule written:** verdict — Step 0 splits the source into **correction** and **method**, both feeding the same steps; Rule 1 forbids waiting for a correction; the Stop hook names both sources.
