# Plan

## Description
Add a new “Create Code Space” action to the Raycast Space Manager extension that creates a macOS Space/Desktop and initializes a ready-to-code workspace flow: open VS Code and Chrome in new windows, create a tmux workspace/session named after the space, and keep cmux in sync when switching spaces via the tool.

## Implementation Guidelines

### Skills
- `agent-setup` — ensure new automation integrates correctly with existing agent/tool conventions.
- `work-cmux` — use documented cmux surface/session orchestration patterns for open/focus behavior.
- `shell-modify` — for any non-trivial command-string composition or shell invocation safety in launcher helpers.

### Coding Patterns
- Keep Raycast command logic in `list-spaces.tsx` using local action handlers and small callbacks.
- Keep system integrations in `hammerspoon.ts` via explicit helper functions, not inline command strings inside UI components.
- Use `hs` CLI-driven Lua snippets for macOS Space operations (current project pattern).
- Keep switching flow consistent: close Raycast window, switch space, then perform follow-up focus operations asynchronously.

### References
- `raycast/space-manager/src/list-spaces.tsx` — action wiring, form submission, switch flow.
- `raycast/space-manager/src/hammerspoon.ts` — helper layering for hs CLI, space CRUD, and window/space focus.
- `/Users/popoffvg/Documents/git/dotfiles/.claude/skills/work-cmux/SKILL.md` — cmux pane/session creation patterns (`new-pane`, `send`, `send-key`, `read-screen`, `close-surface`).
- `harness/plugins/work-manager/claude/bin/cmux-inject.sh` — concrete cmux command usage from existing automation.

## Acceptance Criteria
- [ ] AC1: Raycast shows a “Create Code Space” flow that accepts a space/workspace name.
- [ ] AC2: Creating a code space creates a new macOS Space and stores the provided name for that space.
- [ ] AC3: On code space creation, VS Code opens in a new window and Chrome opens in a new window.
- [ ] AC4: On code space creation, tmux workspace/session is created (or ensured) with the same normalized space name.
- [ ] AC5: When switching to a space via Space Manager, cmux is focused to the workspace mapped to that space name; if cmux is not open, it is opened first.
- [ ] AC6: Existing space operations (rename, delete, window list, normal switch) continue to work.

## Test Checklist (User-assisted)
- [ ] T1 (AC1): In Raycast `Spaces`, verify `Create Code Space` action is visible and opens input form.
- [ ] T2 (AC2): Submit name `Code Test 1`; verify a new macOS Desktop is created and labeled `Code Test 1`.
- [ ] T3 (AC3): After submit, verify VS Code opens in a **new window** (not reusing existing window).
- [ ] T4 (AC3): After submit, verify Chrome opens in a **new window** (not reusing existing window).
- [ ] T5 (AC4): Verify tmux session exists with normalized name via `tmux list-sessions`.
- [ ] T6 (AC5): Switch to the created space via Raycast; verify cmux is opened (if closed) and focused to matching workspace/session.
- [ ] T7 (AC6): Re-run baseline actions: rename space, delete space, open window list, normal switch — all still work.
- [ ] T8 (AC3/AC4/AC5): Force one subsystem failure (VS Code or Chrome or tmux/cmux) and verify toast names exact failing subsystem while previous successful steps remain.

## TODOs
- [x] Add “Create Code Space” UI flow in `raycast/space-manager/src/list-spaces.tsx`.
  - skills: agent-setup
  - criteria: AC1, AC6
  - Add dedicated form/action (separate from generic “Create New Space”) to collect code space name and trigger orchestration.
  - Add explicit ActionPanel item title `Create Code Space` and shortcut `cmd+shift+n`.
  - Test strategy: manual UI validation in Raycast command; verify action visibility, form submit, and success/failure toast paths.

- [x] Add code-space bootstrap helpers in `raycast/space-manager/src/hammerspoon.ts`.
  - skills: shell-modify, work-cmux
  - criteria: AC2, AC3, AC4
  - Implement helper pipeline to: create macOS Space, rename it with provided label, open VS Code new window, open Chrome new window, ensure tmux session by normalized name.
  - Implement `normalizeWorkspaceName(name)` in `raycast/space-manager/src/hammerspoon.ts` (lowercase, trim, whitespace→`-`, remove non `[a-z0-9_-]`, fallback `space-<id>`).
  - Execution environment: local user macOS shell process invoked from Raycast extension runtime.
  - Resource lifecycle: each step returns structured result and does not block UI; timeouts remain bounded.
  - Test strategy: manual integration check after submit (new Space exists, both apps open as new windows, tmux session visible via `tmux list-sessions`).

- [x] Add switch-triggered cmux sync wiring in `raycast/space-manager/src/hammerspoon.ts` and `raycast/space-manager/src/list-spaces.tsx`.
  - skills: work-cmux, shell-modify
  - criteria: AC5, AC6
  - Extend `handleSwitch` in `raycast/space-manager/src/list-spaces.tsx` to call a new post-switch cmux sync helper after `gotoSpace`.
  - In `raycast/space-manager/src/hammerspoon.ts`, resolve space name → normalized workspace name, then resolve workspace ref via `cmux list-workspaces --json` title match, then focus via `cmux select-workspace --workspace <ref|id|index>`.
  - If no workspace exists, create with `cmux new-workspace --cwd <projectDir>` and set title with `cmux rename-workspace --workspace <newRef> <normalizedName>`.
  - Ensure cmux app/socket availability before sync by calling `cmux .` (docs: launches cmux if not running).
  - Scope behavior to switches initiated from Space Manager only.
  - Test strategy: manual scenario test across two spaces (switch via tool, confirm active macOS Space and matching cmux workspace focus/open behavior).

- [x] Add structured partial-failure handling for bootstrap and switch sync in `raycast/space-manager/src/hammerspoon.ts` and toast rendering in `raycast/space-manager/src/list-spaces.tsx`.
  - skills: agent-setup
  - criteria: AC3, AC4, AC5, AC6
  - Return per-step result shape `{ step, ok, errorCode, detail }` from `raycast/space-manager/src/hammerspoon.ts` bootstrap/sync helpers.
  - Map `errorCode` to fixed subsystem-specific toast titles/messages in `raycast/space-manager/src/list-spaces.tsx` (`VS Code`, `Chrome`, `tmux`, `cmux`).
  - Preserve successful earlier steps (no rollback of created space/session on later failure).
  - Test strategy: manual fault injection by temporarily breaking one command path and confirming subsystem-specific error message.

## Open Questions
- [ ] Confirm canonical title-matching policy for cmux workspaces: exact case-insensitive match vs normalized strict match when multiple similar titles exist.
- [ ] Decide fallback when duplicate workspace titles are found: pick first selected window match vs deterministic oldest/newest workspace.

## Design Decisions

### Separate “Create Code Space” from generic “Create New Space”
**Decision:** Keep a dedicated action/flow for code workspace bootstrap instead of overloading existing simple space creation.
**Rationale:** Prevents mixing baseline desktop operations with heavier orchestration and keeps current behavior stable.
**Trade-offs:** Slightly larger action surface in Raycast, but clearer UX and reduced regression risk.

### Workspace naming contract
**Decision:** Derive tmux/cmux workspace identifiers from space name using a normalization function and keep original human-readable name for macOS space label.
**Rationale:** tmux/cmux identifiers have stricter constraints than UI labels.
**Trade-offs:** A name shown in tmux/cmux may differ slightly from display name; improves reliability.

### Switch-triggered cmux sync scope
**Decision:** Apply cmux focus/open synchronization only for switches initiated inside Space Manager.
**Rationale:** Matches requested behavior and avoids global side effects for manual macOS space changes.
**Trade-offs:** External space switches will not auto-sync cmux.

### cmux workspace focus strategy (researched via Firecrawl)
**Decision:** Implement cmux workspace focus by title lookup + workspace selection:
1) ensure cmux is running with `cmux .`;
2) read `cmux list-workspaces --json`;
3) find workspace by title;
4) call `cmux select-workspace --workspace <ref|id|index>`.
If not found, create with `cmux new-workspace --cwd <path>` and set title via `cmux rename-workspace --workspace <ref> <title>`.
**Rationale:** Official cmux CLI docs expose workspace-level commands (`list-workspaces`, `select-workspace`, `new-workspace`, `rename-workspace`) and `cmux .` startup behavior.
**Trade-offs:** Name lookup can be ambiguous with duplicate titles; requires deterministic tie-breaker policy.
