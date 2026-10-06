# Codex routing ledger

Use Codex's available collaboration tools. Read a named agent's instructions before
delegating; preserve an explicit Codex model pin. For a Claude agent definition,
carry its role and instructions into a Codex task and use this ledger's routing
instead of its Claude model identifiers. A definition's `model: inherit` keeps the session
model. For units with no explicit Codex pin:

| Unit | Shape | Model |
|---|---|---|
| One tool call or short edit | inline | current |
| Needs conversation context and would flood it | one agent, `fork_turns: "all"` | inherited |
| Bounded audit, summary, triage, or lookup | one agent, `fork_turns: "none"` | `gpt-6-luna` |
| Independent bounded reading units | one agent per unit, `fork_turns: "none"` | `gpt-6-luna` |
| Writes source with bounded input | one agent, `fork_turns: "none"` | `gpt-6.1-sol` |
| Judges a design or holds the whole task | inline, or an agent with necessary context | inherited |

Use `spawn_agent`, keep its returned identity, and collect messages and completion
notifications; use `send_message` for a running agent and `followup_task` to restart
an idle one. `wait_agent` signals updates, so inspect the delivered results before
marking a unit complete. Pass model overrides only with `fork_turns: "none"` or a
bounded history; full-history forks inherit the session model.

Check the session's available model list before using a pin. If a pin is unavailable,
inherit and disclose the fallback. A deficient bounded `gpt-6-luna` result re-runs
as that unit on `gpt-6.1-sol` when available, otherwise on the inherited model.
Other deficient units retain their routed model on rerun.
Use disjoint write scopes; create separate worktrees before launching writers that
would share paths, and name each absolute checkout in its prompt.

Codex agent final messages reach the parent. Return short verdicts there; put large
reports in explicit files. Describe a requested model as requested unless agent
metadata confirms the actual model; Claude transcript paths provide no Codex evidence.
