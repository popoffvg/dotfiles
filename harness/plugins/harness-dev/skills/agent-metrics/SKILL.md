---
name: agent-metrics
description: Report how the operator and the agent work together, from the per-turn ledger the harness-dev hooks write — re-ask ratio and its causes, prompts to done, prompt quality, pasted blocks that should be a skill, and "You should know" notes. Use for "agent metrics", "how are my prompts", "re-ask ratio", "prompts to done", "what should be a skill", "show the turn ledger".
disable-model-invocation: true
---

# Agent metrics

Pass `--days N` only when the operator names a window; without it both commands read the whole ledger.

## 1. Label the open turns

```sh
python3 ${CLAUDE_PLUGIN_ROOT}/bin/agent-metrics.py classify [--days N]
```

It sends re-asks, task starts, and `understood:` lines to SystemOne models on OpenRouter (token: Keychain `OPENROUTER_API_KEY`) — paid calls, so skip it when the operator wants only the counts. Re-running is safe: a labelled turn is skipped, and a failed one is retried next run. Go on to step 2 after `classified N of M` even when N < M, or after an error, and say which labels are missing.

## 2. Report

```sh
python3 ${CLAUDE_PLUGIN_ROOT}/bin/agent-metrics.py report [--days N]
```

Give the operator the numbers and one action per section; a section with no data gets "no data yet". Done when every printed section has its line:

- **Re-ask** — `missing-in-prompt`: the prompt lacked it. `findable`: a skill or rule is missing. `permission`: run `fewer-permission-prompts`. `user-decision`: no action. `unclassified`: run step 1.
- **Prompts to done** — compare the bucket medians, only buckets with n ≥ 5. If quality 3 does not finish in fewer prompts than quality 0–1, the quality label measures style, not quality. Say so.
- **Understood lines** — corrections show where the agent read the prompt wrong; the self-score counts the context and the Jev quality sees only the prompt and the reply before it, so the gap between them is what the context gives.
- **Pasted blocks in 2+ sessions** — each is a skill candidate; its `{todo}`, `{ticket}`, `{path}`, `{n}` placeholders are the skill's arguments.
- **"You should know" notes** — assumptions the built-in side agent flagged in these sessions.

## Terms

- **Re-ask**: a reply that ends with `triage: question` or calls `AskUserQuestion`.
- **Task**: the turns from a task-start prompt to the reply that ends with `triage: done`. A prompt starts a task when it is the first of the session, follows `triage: done`, or has 200+ characters.

## Switches

Both ship off; the operator sets them in the `env` block of `settings.json`. Report their state; change it only when asked:

- `HARNESS_DEV_PASTE_NUDGE=1` — after a block is pasted 3+ times in 2+ sessions, the agent offers to make it a skill.
- `HARNESS_DEV_UNDERSTOOD=1` — each task-start reply opens with `understood: goal=… · limits=… · acceptance=… · prompt N/3`. The `classify` correction label needs it.
