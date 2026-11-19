# Shared routing ledger

Resolve each effort tier through the active harness's `harness/effort-ledger.json`. Apply both its model and reasoning setting. Shared instructions name tiers, not models.

An explicit task symbol wins over a named agent's default tier. Otherwise, keep the named role's source tier. Use the first matching row for unnamed work.

| Unit | Shape | Effort |
|---|---|---|
| Starts agents | run the agent loop in the calling session | each child keeps its task tier |
| Independent bounded units | one agent per unit, launched together | classify each unit |
| Architecture, difficult diagnosis, or high-risk implementation | inline or one bounded agent | `{heavy}` |
| One tool call or short edit | inline | current |
| Writes source or performs a focused review | inline or one bounded agent | `{medium}` |
| Bounded audit, summary, triage, lookup, or mechanical check | one agent with a self-contained prompt | `{light}` |
| Needs conversation context and would flood it | one agent with the necessary context | classify its task |

Read named-agent instructions and use the active harness's delegation tool. In Claude, use `Agent` and `subagent_type`. A Claude fork inherits context but MUST NOT start agents.

The source agent's `harness-effort` declares its default tier. Installed agents receive native model and reasoning settings. Use `effort-light`, `effort-medium`, or `effort-heavy` for unnamed work. Keep the named role for specialized work; use a generated tier variant when the task requires another tier. If that variant is unavailable, block that unit instead of replacing its role with a generic agent.

A result is deficient when reasoning misses an explicit acceptance check or required deliverable. Escalate only that unit: `{light}` → `{medium}` → `{heavy}`. After a deficient `{heavy}` result, report its unmet check and mark that unit blocked. Continue authorized independent units. Fix credentials or configuration for launch failures; do not treat them as reasoning failures.

Claude's native `Agent` call does not expose a separate effort argument. Use the configured agent definition. For CLI jobs, use `python3 ~/.claude/harness/effort.py claude <tier> -- claude <args>`. Other runtimes use their native settings from the ledger. If inline execution or a context fork cannot apply the requested profile, use a fresh agent with a self-contained prompt.

Give parallel writers disjoint write scopes. Use separate worktrees when writers would share a path.

For background agents, name an absolute output file and require the agent to return its path. Await completion before collecting the file. An idle notification alone carries no report body.

Report requested settings separately from confirmed settings. If metadata is absent, mark actual model and reasoning settings unconfirmed. A confirmed mismatch blocks that unit pending configuration repair. In Claude, check `message.model` in the agent's JSONL under `~/.claude/projects/`; the caller's transcript is not confirmation.
