# Cases

## 2026-08-10 — Skill audit delegated to haiku on the operator's direction

- **Repo:** /Users/vitaliipopov/git/dotfiles
- **Source:** method — the user stated the tool choice before the work ran
- **Task:** Reduce and generalize the session-cost-audit skill, then the whole skill corpus
- **What I did:** Was about to analyze the SKILL.md inline with the main model (Fable/Opus)
- **User's words:** > Analyze skill call (launch haiku agent, not fable for that) and after merge skill as possible
- **Evidence:** none — stated method
- **Ambiguous?** yes — the other branch is right when the analysis needs cross-task judgment (design trade-offs, ambiguous evidence); the rule covers bounded read-and-report work only
- **Scope chosen:** global — the situation (a bounded analysis subtask inside a bigger task) recurs on any repo and is worth teaching
- **Rule written:** verdict scoped to bounded read-and-report subtasks — delegate them to a haiku subagent; keep synthesis and edits on the main model
- **Transcript:** ~/.claude/projects/-Users-vitaliipopov-git-dotfiles/3f09d27e-8e01-4e53-ac34-02a7e0ae01b2.jsonl
- **Session topic:** reduce and generalize the Claude skill corpus

## 2026-08-11 — Haiku agent for a corpus diagnosis: right model, wrong split, invented counts

- **Repo:** `/Users/vitaliipopov/git/dotfiles`
- **Source:** method — the user named the model while approving the plan, before the work ran
- **Task:** Design a personal English-learning system; parse one week of the user's Claude Code prompts and diagnose his sentence-construction patterns and vocabulary profile
- **What I did:** Proposed the parse as a few hours of work without naming a model, i.e. would have run it on the main model or an inherited-model subagent
- **User's words:** > run subagent with haiku model for that
- **Evidence:** the first haiku run produced only `raw_prompts.jsonl` (42140 unfiltered lines including `<command-name>` blocks) and no report; the second run, handed a pre-built corpus, reported "23 missing-copula instances" and "28 modal errors" where `grep -oiE "that (related|used|created)" week-corpus.txt | wc -l` returned 2 and `grep -oiE "(must|should) to\b" … | wc -l` returned 0
- **Ambiguous?** no — the delegation was right; the two failures were in how the work was split and in trusting the numbers
- **Scope chosen:** global — extraction-then-analysis and unchecked model arithmetic recur on any repo
- **Rule written:** two bullets appended to the existing skill — do the deterministic extraction yourself and hand the agent a finished file; re-check every reported number with one grep before relaying it
- **Transcript:** `~/.claude/self-improvement/lessons/global/2026-08-11-build-discord-bot-for-english-learning-7bf070e7-3994-430a-983d-cd8a66a93a3c.jsonl`
- **Session topic:** Build Discord bot for English learning
