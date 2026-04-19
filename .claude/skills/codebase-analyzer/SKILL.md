---
name: codebase-analyzer
description: Router skill for codebase analysis. Launches three subagents: implementation analyzer, DDD terms/relations extractor, and constraint extractor. Merges outputs into one evidence-backed report with file:line references.
argument-hint: [component, feature, or path to analyze]
---

# Codebase Analyzer (Router)

This skill is an orchestrator. Do not do a single-pass analysis directly.

## Strict scope gate (run before anything else)

Use this skill **only** for analysis/audit requests ("analyze", "map", "understand", "what does this do").

Do **not** use this skill for operational fix requests (for example: permissions, git hooks, CI failures, installs, "fix it", "make it executable"). In those cases, perform the requested fix workflow directly or use the appropriate skill.

If the user request is ambiguous (e.g. "fix it" without an explicit analysis goal), ask one clarifying question instead of launching subagents.

## Goal

Produce one combined analysis that covers:
1. **Current implementation behavior** (how code works today)
2. **Domain terms and relations** (DDD language model)
3. **Current constraints** (technical and domain constraints enforced by code/config)

All claims must be backed by `absolute/path:line` references.

## Routing contract

Run **three subagents** in parallel for the same target:

1. `codebase-analyzer-implementation`
2. `codebase-analyzer-ddd-terms`
3. `codebase-analyzer-constraints`

If parallel execution is unavailable, run sequentially in the same order.

## Invocation template (deterministic)

Use this exact shape when calling the `subagent` tool:

```json
{
  "tasks": [
    {
      "agent": "codebase-analyzer-implementation",
      "task": "Analyze target: <TARGET>. Return only the Implementation section with absolute path:line citations."
    },
    {
      "agent": "codebase-analyzer-ddd-terms",
      "task": "Analyze target: <TARGET>. Return only Terms/Aliases/Relations with absolute path:line citations."
    },
    {
      "agent": "codebase-analyzer-constraints",
      "task": "Analyze target: <TARGET>. Return only Constraints (hard/soft/interactions) with absolute path:line citations."
    }
  ]
}
```

Execution rules:
- Prefer one parallel call with the 3 tasks.
- Set `context: "fresh"` unless prior context is explicitly required.
- If any subagent fails, retry that subagent once with a narrower target; otherwise continue with successful outputs and mark missing sections as `needs verification`.

## Input normalization

- If user gave a path/component, pass it unchanged to all subagents.
- If user said `continue`, resume using the last unresolved analysis target.
- If target is ambiguous, ask one concise clarifying question before launching subagents.

## Merge procedure

After all subagents return:

1. Keep only evidence-backed statements.
2. Normalize terminology (prefer domain term names from DDD output).
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
- **Constraint** — where/how enforced (`/abs/path/file.ext:line`)

### End-to-End Flow (optional)
- Add only if a concrete execution flow exists.

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
