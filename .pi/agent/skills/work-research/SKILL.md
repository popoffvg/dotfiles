---
name: work-research
description: >
  This skill should be used when the current work phase is "research".
  Provides the research workflow: scope breakdown, codebase exploration,
  saving findings to _notes/research-*.md, and transition to plan phase.
---

# work:research

Research phase workflow. Primary deliverable: `_notes/research-*.md` files with findings.

## Step 1: Plan research scope

Break scope into independent topics. Present a numbered list:

```
[RESEARCH] I'd like to explore:
1. Auth middleware in core/pl/pkg/auth/
2. SDK auth client in core/platforma/sdk/
3. Session storage in core/pl/pkg/session/

Proceed? (y / n / adjust)
```

**Wait for user approval.** Do NOT start research until confirmed.

## Step 2: Explore each topic

## Option-selection handling (friction guard)

If you offered options and the user replies with a selection (for example, "option A"):
- Treat it as approval to proceed with that exact path.
- Start execution immediately; do not restate the same options.
- If the user asks to "read the skills" or "read Pi logic", do that first, then continue research with those constraints.


For each topic, gather information:
- Search codebase for relevant files and patterns
- Read key source files, configs, docs
- Search QMD knowledge base for prior findings
- Check git history for recent changes in the area
- When investigating logs/runtime artifacts, verify execution context first (host vs container vs pod). Never assume host filesystem paths.
- If logs are produced inside a container/pod, inspect via runtime tools (`docker logs`, `kubectl logs`, or shell inside container) and record the exact source path/command in findings.

Run independent topics in parallel by spawning subagents via the Agent tool — one subagent per topic. Each subagent explores its topic and returns findings. The research agent then writes `_notes/research-*.md` files from the results.

## Step 3: Save findings (PRIMARY DELIVERABLE)

For each completed topic:

1. Write findings to `_notes/research-<topic-slug>.md`
2. Update `_notes/plan.md` Work Notes section with link: `- [<topic>](research-<topic-slug>.md)`
3. Then — and only then — summarize to the user

File template:
```markdown
# Research: <Topic>

Created: YYYY-MM-DD

## Findings

<what was discovered — files, patterns, behavior, architecture>

## Key Files

- `path/to/file.go:42` — description
- `path/to/other.ts:15` — description

## Open Questions

- <anything unclear or needing deeper investigation>
```

## Step 4: Respond to user

Summarize findings with references to `_notes/` files. Keep chat response concise — detailed content lives in the files.

## Step 5: Suggest next research or transition

If new areas emerged, propose them as a new numbered list.

If research feels complete (can articulate the problem, know the repos, understand patterns, no major unknowns), suggest:
```
Research looks complete. When ready, use `/work update move to plan` to begin planning.
```

## Writing rules

- **One topic = one file.** Never dump multiple unrelated findings into one file.
- **File naming**: `_notes/research-<topic-slug>.md`
- **Save immediately.** Write after each topic completes — don't accumulate.
- **Max 100 lines per file.** Split if growing beyond.
- **Update the index.** Every new file must be linked in `_notes/plan.md` Work Notes section.

## Completion signals

- Can articulate the problem clearly
- Know which repos/packages are involved
- Understand existing patterns and constraints
- No major unknowns remaining (or unknowns are identified and scoped)

Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: <action summary>`

## Autoresearch rules

**Eval checklist:**
1. Did the agent present a numbered scope list and wait for user approval before starting?
2. Does every research file (`_notes/research-*.md`) contain concrete findings (code paths, API signatures, config values) — not vague summaries?
3. Were zero code changes made during research (read-only phase)?
4. Did the research cover all topics in the approved scope list?

**Test inputs:**
- "Research auth middleware implementation in a Go monorepo"
- "Research 3 competing libraries for PDF generation"
- "Research why CI pipeline fails on macOS runners"

**Can change:** scope presentation format, research file structure, topic exploration depth, transition criteria
**Cannot change:** user approval before starting, read-only enforcement, output to _notes/research-*.md
**Min sessions before eval:** 5
**Runs per experiment:** 3
