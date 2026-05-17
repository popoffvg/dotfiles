---
name: codebase-analyzer
description: Router skill for codebase analysis. Launches one implementation analyzer subagent and produces one evidence-backed report with file:line references.
argument-hint: [component, feature, or path to analyze]
---

# Codebase Analyzer (Router)

This skill is an orchestrator. Do not do a single-pass analysis directly.

## Strict scope gate (run before anything else)

Use this skill **only** for analysis/audit requests ("analyze", "map", "understand", "what does this do").

Do **not** use this skill for operational/edit requests (for example: permissions, tool permission updates, AGENTS/agent guide edits, git hooks, CI failures, installs, "fix it", "make it executable"). In those cases, do the requested edit workflow directly (read target file, edit, validate) or use the appropriate skill.

If the user request is ambiguous (e.g. "fix it" without an explicit analysis goal), ask one clarifying question instead of launching subagents.

## Goal

Produce one combined analysis that covers:
1. **Current implementation behavior** (how code works today)
2. **Domain terms and relations** (DDD language model)
3. **Current constraints** (technical and domain constraints enforced by code/config)

All claims must be backed by `absolute/path:line` references.

## Routing contract

Run **one subagent only** for the target:

1. `codebase-analyzer-implementation`

Do **not** use parallel execution.

## Invocation template (deterministic)

Use this exact shape when calling the `subagent` tool:

```json
{
  "agent": "codebase-analyzer-implementation",
  "task": "Analyze target: <TARGET>. Return Implementation, Domain Terms/Relations, and Constraints with absolute path:line citations."
}
```

Execution rules:
- Run exactly one subagent call (single mode), never in parallel mode.
- Set `context: "fresh"` unless prior context is explicitly required.
- If the subagent fails, retry once with a narrower target; otherwise mark output as `needs verification`.

## Input normalization

- If user gave a path/component, pass it unchanged to all subagents.
- If user said `continue`, resume using the last unresolved analysis target.
- If target is ambiguous, ask one concise clarifying question before launching subagents.
- If the user asks to "read guide" and "add permission" (or similar edit verbs), treat it as an edit task, not analysis routing.

## Tooling requirement

Use **cocoindex** and **fff** MCP servers for code discovery and evidence collection.
- Prefer cocoindex for semantic/code-graph discovery.
- Prefer fff for fast path/content lookup.

## Tool permission

When executing this skill, allow only the tools required for analysis output:
- `mcp` (must use only `cocoindex` and `fff` servers)
- `read`
- `write` (only for `_notes/analysis-<target>.md`)

## Merge procedure

After the subagent returns:

1. Keep only evidence-backed statements.
2. Normalize terminology.
3. Resolve contradictions by preferring directly cited code over inference.
4. Build one unified report.

## Output file

Always write final result to:

`_notes/analysis-<target>.md`

Use short kebab-case `<target>`.

## Final output format

```md
## Analysis: <Target>

### Overview
- 2-4 bullets summarizing behavior, domain model, and key limits.

### Implementation (Current Behavior)
- Evidence-backed explanation of entry points, flow, transformations, side effects.

### Domain Terms (DDD)
#### Terms
- **Term** — definition (`/abs/path/file.ext:line`)

#### Relations
- **TermA -> TermB**: relation description (`/abs/path/file.ext:line`)

### Constraints

Express constraints as **TypeScript-style pseudocode** inside a component namespace.
Use `throw` for hard constraints and comments for soft constraints.

```ts
namespace <Target>Component {
  export function validateConstraints(input: <InputType>): void {
    // hard constraints (must hold)
    if (!(<invariant description>)) {
      throw new Error("<constraint name>") // /abs/path/file.ext:line
    }

    if (!(<invariant description>)) {
      throw new Error("<constraint name>") // /abs/path/file.ext:line
    }

    // soft constraints (warn/operational limits)
    // WARN: <soft limit description> // /abs/path/file.ext:line
  }

  export function describeConstraintInteractions(): void {
    // <ConstraintA> + <ConstraintB> => <combined effect> // /abs/path/file.ext:line
  }
}
```

### Flow (optional)

Express flow as **TypeScript-style pseudocode** with a namespaced state model.
Only include if a concrete execution flow exists.

```ts
namespace <Target>Component {
  export type State = "<stateA>" | "<stateB>" | "<stateC>"

  export function transition(state: State, trigger: string): State {
    if (state === "<stateA>" && trigger === "<trigger>") {
      return "<stateB>" // /abs/path/file.ext:line
    }
    if (state === "<stateA>" && trigger === "<trigger>") {
      return "<stateC>" // /abs/path/file.ext:line
    }
    return state
  }

  export function assertStateInvariants(state: State): void {
    if (!(<state-level invariant>)) {
      throw new Error("State invariant failed") // /abs/path/file.ext:line
    }
  }
}

function flow() {
  <TargetComponent>.transision(/*params*/)
  <TargetComponent>.assertStateInvairants(/*params*/)
}
```

### Sources
- Flat list of referenced files.
```

## Non-goals

- No recommendations
- No refactors
- No bug hunting
- No quality critique
- No speculative architecture

Describe only what exists now.
