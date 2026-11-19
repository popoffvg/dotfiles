# Codex effort ledger

Read `~/.codex/harness/effort-ledger.json`. Resolve both the model and `model_reasoning_effort` for the task's tier.

An explicit task symbol wins over a named agent's default tier. Otherwise, keep the named role's source tier. Use the first matching row for unnamed work.

| Unit | Effort |
|---|---|
| Architecture, difficult diagnosis, or high-risk implementation | `{heavy}` |
| Source changes or focused reviews | `{medium}` |
| Bounded audits, summaries, triage, lookups, or mechanical checks | `{light}` |

Use named agents with their compiled effort settings. For unnamed work, use `effort-light`, `effort-medium`, or `effort-heavy`. Keep the specialized role's instructions and permissions when selecting a tier variant. Block that unit if its required named variant is unavailable.

Use the available Codex collaboration tools. Keep the spawned agent identity and inspect its result after completion. Give independent writers disjoint paths or separate worktrees.

Use fresh or bounded context when the task needs a different model or reasoning setting. Full-history forks inherit the session configuration; do not claim that an incompatible effort profile applied.

A result is deficient when reasoning misses an explicit acceptance check or required deliverable. Escalate that unit from `{light}` to `{medium}`, then to `{heavy}`. After a deficient `{heavy}` result, report its unmet check and block that unit. Continue authorized independent units. Authentication, quota, and transport failures require repair, not a tier change.

Report the requested tier and settings. Confirm actual use from Codex metadata before reporting it as fact. Mark missing model or reasoning metadata unconfirmed. A confirmed mismatch blocks that unit pending configuration repair.
