# Cursor effort ledger

Read `~/.cursor/harness/effort-ledger.json`. Resolve the task's tier to its model selector, including the reasoning parameter.

An explicit task symbol wins over a named agent's default tier. Otherwise, keep the named role's source tier. Use the first matching row for unnamed work.

| Unit | Effort |
|---|---|
| Architecture, difficult diagnosis, or high-risk implementation | `{heavy}` |
| Source changes or focused reviews | `{medium}` |
| Bounded audits, summaries, triage, lookups, or mechanical checks | `{light}` |

Use Cursor's Task tool with the named agent's compiled profile. Use `effort-light`, `effort-medium`, or `effort-heavy` for unnamed work. Keep the specialized role's instructions and read-only permissions. Block that unit if its required named variant is unavailable.

Give each agent a self-contained prompt. Launch independent units together. Give parallel writers disjoint paths or separate worktrees and name their absolute checkout paths.

Return short verdicts in final messages. Put large reports in explicit files and await completion before reading them.

A result is deficient when reasoning misses an explicit acceptance check or required deliverable. Escalate that unit from `{light}` to `{medium}`, then to `{heavy}`. After a deficient `{heavy}` result, report its unmet check and block that unit. Continue authorized independent units. Repair authentication, quota, and transport failures without changing tiers.

Cursor can substitute a model because of plan or administrator restrictions. A confirmed mismatch blocks that unit pending configuration repair. Report requested settings separately from confirmed metadata. Mark absent model or reasoning metadata unconfirmed.
