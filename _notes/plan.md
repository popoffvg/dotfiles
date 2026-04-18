# Plan

## Description
Harden Claude harness phase enforcement so workflow guard behavior is fail-closed, observable, and less likely to be skipped due to hook startup latency.

## Implementation Guidelines

### Skills
- `work-commit` — keep commit boundaries aligned with TODOs.
- `shell-modify` — if command wrapper behavior is adjusted in hook scripts.
- `work-auto-verify` — verify only latest changes against this plan after implementation.

### Coding Patterns
- Keep policy logic in shared work-manager core (`common/hooks.ts`, `common/fsm.ts`); keep Claude adapter thin (`claude/bin/hook-runner.ts`, `claude/hooks/hooks.json`).
- Use best-effort logging style already used in work-manager utilities (catch and continue, no throw in guard path).
- Return explicit block decisions from guard hook when policy cannot be evaluated.

### References
- `harness/plugins/work-manager/claude/bin/hook-runner.ts` — Claude hook adapter dispatch for guard/inject paths.
- `harness/plugins/work-manager/claude/hooks/hooks.json` — hook wiring and timeout configuration.
- `harness/plugins/work-manager/common/hooks.ts` — shared guard() used by Claude and Pi.
- `harness/plugins/work-manager/common/fsm.ts` — authoritative phase/tool restrictions (`guardToolCall`).

## Acceptance Criteria
- [x] AC1: PreToolUse guard fails closed when hook input is empty, invalid JSON, or lacks `tool_name`.
- [x] AC2: Guard path writes decision telemetry (`allow`/`block`, reason, tool, timestamp) to a stable local log file.
- [x] AC3: PreToolUse guard timeout is increased to reduce false pass-through from slow hook startup.
- [x] AC4: Existing valid guard behavior remains unchanged for normal parsed inputs.

## TODOs
- [x] TODO1: Implement fail-closed guard decisions in `harness/plugins/work-manager/claude/bin/hook-runner.ts`.
  - skills: shell-modify, work-commit
  - criteria: AC1, AC4
  - ensure `guard` case emits `{ decision: "block", reason }` for:
    - empty stdin payload
    - JSON parse failure
    - missing/blank `tool_name`
  - preserve current behavior for valid parsed payloads by delegating to `guard(process.cwd(), toolName, toolInput)`.
  - test strategy: unit-like manual hook simulation by feeding representative stdin payloads to guard path and confirming JSON output shape for blocked vs normal flows.
  - execution environment: Claude hook runtime (`npx tsx .../hook-runner.ts guard`) on local user shell.

- [x] TODO2: Add guard telemetry logging in `harness/plugins/work-manager/claude/bin/hook-runner.ts`.
  - skills: shell-modify, work-commit
  - criteria: AC2, AC4
  - append JSONL entries to `.pi/work-guard.log` with timestamp, decision, reason, tool name, cwd.
  - log both block and allow outcomes for guard path.
  - resource lifecycle: use append-only file writes; no persistent handles.
  - test strategy: run guard path with both allow/block samples and confirm log lines are appended with required fields.
  - execution environment: same Claude hook runtime as TODO1.

- [x] TODO3: Increase PreToolUse guard timeout in `harness/plugins/work-manager/claude/hooks/hooks.json`.
  - skills: work-commit
  - criteria: AC3, AC4
  - update guard hook timeout from `3000` to `10000` ms.
  - test strategy: config verification by reading resulting JSON and confirming only PreToolUse guard timeout changed.
  - execution environment: Claude plugin hook config consumed by Claude session startup.

## Design Decisions

### Fail-closed guard outcome
**Decision:** Block tool execution when guard hook cannot parse/evaluate input.
**Rationale:** Prevents silent bypass when hook invocation data is missing or malformed.
**Trade-offs:** May block legitimate operations during transient hook/input failures.

### JSONL telemetry location
**Decision:** Store guard telemetry in `.pi/work-guard.log` within current workspace.
**Rationale:** Keeps diagnostics local to repository/work context and easy to inspect.
**Trade-offs:** Additional local log growth; requires occasional cleanup policy outside this change.

### Timeout increase to 10s
**Decision:** Raise PreToolUse hook timeout from 3s to 10s.
**Rationale:** Reduces false pass-through when `npx tsx` startup is slow.
**Trade-offs:** Longer wait before hook timeout in failure scenarios.

## Open Questions
- [ ] Should telemetry be rotated/truncated automatically, or remain append-only for now?
- [ ] Should `inject` hooks also move to 10s timeout, or only `guard`?
