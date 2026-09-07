## 2026-08-05 — repeated idle-notification narration from a resumed triage subagent

- **Repo:** dotfiles (`~/git/dotfiles`)
- **Task:** building a Stop-hook triage subagent for the self-improvement plugin that is resumed by name (`SendMessage`) across a session instead of relaunched fresh each time.
- **What I did:** every time the named subagent finished a re-check and went idle, its `idle_notification` teammate-message arrived, and I replied with a sentence explaining it was just an idle notification needing no action — repeated verbatim several times in a row.
- **Correction:** > How remove
  Just an idle-notification — no action needed.
   that line?
- **Evidence:** conversation transcript — the same explanatory sentence recurring after each `idle_notification` teammate-message.
- **Ambiguous?** no — the harness requires some visible output per turn, but nothing about an idle notification needs explaining every time.
- **Scope chosen:** global — any session that resumes a named background agent via `SendMessage` will see the same repeated idle notifications; not tied to this repo or plugin.
- **Rule written:** verdict — reply with the barest minimum ("Noted.") instead of narrating the idle notification.

## 2026-08-10 — background subagents went idle and never delivered their reports

- **Repo:** dotfiles (`~/git/dotfiles`)
- **Source:** discovery — no user statement; found by trying every retrieval path.
- **Task:** spawned two named background agents (`verbosity-cause`, `speedup-hypotheses`) to analyse why Claude writes over-long specs and how to speed up a session.
- **What I did:** treated each `idle_notification` as "still working", replied with a waiting line, and burned three turns. Then tried `ListAgents` (listed only unrelated peer sessions — neither spawned agent appeared), `TaskList` (returned "No tasks found"), and `SendMessage` to both agents asking for their report (both accepted the message, neither answered). Only re-running both prompts with `run_in_background: false` returned the full reports.
- **User's words:** > (none — discovery)
- **Evidence:** three `idle_notification` teammate-messages from `verbosity-cause`/`speedup-hypotheses` with no task notification; `ListAgents` output "Peer sessions (5)" containing neither name; `TaskList` → "No tasks found"; the synchronous re-run returned both final reports in one tool result (94,621 and 94,864 subagent tokens).
- **Ambiguous?** no — once idle has fired and no result notification exists, waiting cannot produce one.
- **Scope chosen:** global — applies to any session spawning background agents, not to this repo.
- **Rule written:** verdict — an idle notification is not a delivered report; re-run the prompt synchronously instead of waiting or chasing it with ListAgents/TaskList/SendMessage.
- **Transcript:** not archived
- **Session topic:** why Claude writes over-long duplicated specs; speeding up similar sessions
