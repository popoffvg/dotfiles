---
name: quiet-teammate-idle-notifications
description: Use when a teammate-message arrives that is just an idle_notification (idleReason "available") from a background or named subagent going idle, or when a background subagent goes idle without ever delivering its report. Applies to any session using SendMessage-addressable background agents, not one specific plugin.
metadata:
  origin: self-improvement
---

An `idle_notification` teammate-message means a background subagent finished its last task and is waiting — nothing needs a decision or an action.

Do not narrate or explain it with a sentence like "Just an idle-notification — no action needed." That line repeats every time the agent goes idle and reads as noise once a subagent is reused across many turns (e.g. resumed by name via `SendMessage` instead of relaunched fresh each time).

The harness still requires some visible output per turn, so reply with the barest minimum — a single word like "Noted." — instead of a repeated explanatory line.

An idle notification is not a delivered report. When a background agent you spawned for an answer signals idle and no task notification with its result has arrived, the report is lost, not pending. Do not keep waiting across turns, and do not chase it with `ListAgents` (which may not list it), `TaskList` (which may be empty), or a `SendMessage` asking for the report. Re-run the same prompt with `run_in_background: false` — the synchronous call returns the agent's final message directly. Re-running costs one duplicate agent run; waiting costs an unbounded number of empty turns.
