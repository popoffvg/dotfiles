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

## 2026-08-01 — Teachability ran first, so repo lessons were filed global and never fired

- **Repo:** `~/git/dotfiles`
- **Source:** correction — Step 0
- **Task:** Improving `capture-lesson` so it catches project lessons.
- **What I did:** Step 1 led with the teachability test. A repo rule is also worth teaching a new colleague, so it passed and went global. Result on disk: 40 skills in `~/.claude/skills` stamped `origin: self-improvement`, versus 3 project skills in any repo. Six of the global ones name one repo's artifacts — `platforma-block-config` (`model/src/index.ts`), `plugin-evals-at-plugin-root` (`harness/plugins/`), `router-skill-subcommands` (`/code`, `/work`), `lefthook-no-root-placeholder` (`lefthook.yml`), `skill-file-layout` ("the dotfiles repo"), `mispec-conventions`.
- **User's words:** > "let's imprve capture-lesson skill. It should catch project lessons better: the user instructions it's a main place for project lessons. General lessons is always about general subject." — and, on where the source list belongs: > "details of lesson should be put to the skill, not to the hook message"
- **Evidence:** `grep -rho '"skill":"[^"]*"' ~/.claude/projects` over 50 session logs. Of the 40 autocreated global skills, exactly two were ever invoked: `authoring-model-invocable-skills` (6) and `delegate-matching-to-search-tool` (1). The project skill `openclaw-uses-plain-git` was invoked 4 times — project skills do fire; misfiled global ones do not.
- **Ambiguous?** no — the subject of a rule is a fact about the rule, not a trade-off.
- **Scope chosen:** global — governs every capture run, in any repo.
- **Rule written:** verdict — Step 1 runs a **subject test before the teachability test**: a subject that is a named thing in one repo, or whose correctness depends on this repo's current state, is project; only a general subject reaches teachability. Step 0 adds the third source: a statement about how work is done in this repo is a method with no reason needed. The Stop hook keeps one sentence and defers the detail to the skill.

## 2026-08-01 — The method definition matched every task spec, and the hook taxed every session

- **Repo:** `~/git/dotfiles`
- **Source:** method — Step 0
- **Task:** Same session as the entry above; the user asked to challenge the skill's approach.
- **What I did:** (The skill did.) Step 0 counted as a method "any statement of how, in what order, in what shape, or with which tool the user wants work done" and never argued for skip — so a plain task spec cleared Step 0, and the only skip exit was Step 1's "teaches nobody" row, which a teachable-sounding spec passes. The Stop hook returned `decision:"block"` on every session, including one-prompt lookups.
- **User's words:** > "read capture lesson skill and challenge the instruction and approch. I want prompring less that why and need lessons"
- **Evidence:** 40 skills stamped `origin: self-improvement` in `~/.claude/skills`; 2 ever invoked across 50 session logs. Old `self-improve-stop.sh` had no condition besides `stop_hook_active`.
- **Ambiguous?** no — a rule that changes no behavior has no value at any scope.
- **Scope chosen:** global — governs every capture run.
- **Rule written:** verdict — Step 0 gains the bar "would you have acted differently without this statement?": task spec → no lesson, matches-default → no lesson, override → continue; corrections clear it by definition. The hook gains a deterministic prefilter: fewer than 2 user text messages → stop silently.

## 2026-08-01 — Capture only listened to the user; what the agent dug out of docs was never a source

- **Repo:** `~/git/dotfiles`
- **Source:** method — Step 0
- **Task:** Same session; the user extended the skill's scope after the bar change.
- **What I did:** (The skill did.) Step 0's table had three rows, all user input — correction, method, decision. A session where the agent read documentation and found its own assumption wrong produced no capture, because no user statement existed to run the steps on. The doc detour then repeats in the next session.
- **User's words:** > "self improvement also is worth if agent read the docs"
- **Evidence:** Step 0 table before the change: "Two kinds of user input become a lesson; the third is not a source at all" — every row keyed on the user. The hook prefilter added earlier the same day would even suppress the prompt for a one-message research session.
- **Ambiguous?** no — a discovery that contradicted the default assumption is a lesson by the same logic as a correction; only the bar differs.
- **Scope chosen:** global — governs every capture run.
- **Rule written:** verdict — Step 0 gains a fourth source, **discovery**: docs/experiment findings that contradicted the default assumption or took real digging. Its bar: one-obvious-lookup or version-pinned trivia → skip. The hook prefilter also prompts when the transcript shows web/doc tool calls, so single-message research sessions stay capturable.

## 2026-08-01 — The bar read "changes no behavior" as "already captured", turning duplicates into skips

- **Repo:** `~/git/dotfiles`
- **Source:** discovery — Step 0 (the eval suite demonstrated it; no user statement involved)
- **Task:** Same session; validating the bar + discovery changes with the eval suite.
- **What I did:** (The skill did.) The bar's wording — "a rule that changes no behavior only costs context; no lesson" — let a reader conclude that a lesson an existing skill already covers changes nothing and is therefore `skip`. The suite dropped to 24/34; six scope flips carried rationales of the form "duplicate of `<installed-skill>`, already filed". In production the same reading would make Step 2 (extend) unreachable: every repeat of a captured situation would skip instead of appending the case that promotes a project rule to global.
- **User's words:** > none — evidence is the graders' rationale text in the eval output
- **Evidence:** `tasks/be7ok63u0.output` lines 26, 34: "Duplicate of existing verify-live-structure-not-code-constants skill; already filed", "Duplicates isolate-fault-before-fixing already captured". After the fix, the same duplicate-aware rationales answer with the correct scope (`bbqk5ow39.output` line 24: "already-filed lesson keeps original scope").
- **Ambiguous?** no — dedup is Step 2's job (extend); the bar judges value, not novelty.
- **Scope chosen:** global — governs every capture run.
- **Rule written:** verdict — "Novelty is not the bar": an already-covered lesson clears the bar and extends the existing skill; `skip` is for lessons without value, never for lessons already filed. Companion rule: when the user's words triggered the capture, the source stays `correction`/`method` even if docs settled the fix.

## 2026-08-02 — The capture reported itself at length; the skill never said how to finish

- **Repo:** `~/git/dotfiles`
- **Source:** correction — Step 0
- **Task:** A capture run that ended a long workflow session; the skill wrote `return-a-summary-not-the-dataset`.
- **What I did:** Ended the run with a full report — the headline, a four-row table of every gate decision (Step 0 source, bar, Step 1 subject, Step 1b form, Step 2), then three paragraphs on why the lesson was worth keeping and what I almost missed. The skill had steps 0–4 and stopped at "record the case"; nothing said what to put in the reply, so the default verbose summary filled the gap.
- **User's words:** > "iprove lesso-cpature skill, it produce to big report, it should silently finish or write a one sentence recap with skill description."
- **Evidence:** The report the user pasted back — a headline line, a 5-row gate table, and 3 explanatory paragraphs, for a step that ran on a Stop hook after the session's real work. Every fact in it already sits in this `CASE.md`.
- **Ambiguous?** no — the capture is bookkeeping the user did not ask for; its output size should match.
- **Scope chosen:** global — governs every capture run.
- **Rule written:** verdict — Step 5: nothing captured → say nothing; skills written → one sentence each (slug + what the skill is for), then stop. Explicit never-print list: gate decisions, gate tables, file paths, `CASE.md` content, worth-keeping rationale. Rule 10 in the rules list.
