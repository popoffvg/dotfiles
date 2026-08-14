---
name: dive-docs
description: The `docs` route of `/dive` — write markdown research artifacts, one per entry point, graded against the 6-step chain, and converge until nothing new surfaces. Loaded by the `dive` router; it fans out `explorer` agents to write and `explore-critic` agents to grade.
user-invocable: false
---

# dive · docs route (default)

Dive into the codebase by writing **markdown research artifacts + question lists**, one pair per
entry point. Prose write-ups graded against the 6-step chain. No `.workflow.ts`, no bindings — that
is the `workflow` route.

Do it until the stop criteria are met: **stop when no open question and no unexplored branch remain.**

## The files this skill owns

| File | Holds |
|---|---|
| `references/ref-artifact.md` | The artifact contract — the 6-step chain and the `.md` section order. Both agents read it; nothing here restates it. |
| `references/ref-grill.md` | The grill phase — how `<ep-slug>.questions.md` is generated. |
| `references/ref-converge.md` | The convergence loop — grade, discover, re-spawn, stop. |

## The two agents

You orchestrate; the agents do the reading. Both are `model: sonnet`, and both read
`ref-artifact.md` themselves — **never paste the artifact contract into a prompt.**

| Agent | Does | Spawned |
|---|---|---|
| `explorer` | Writes one `<ep-slug>.md` for one entry point. | One per entry point, first round and every gap-filling round. |
| `explore-critic` | Grades one `<ep-slug>.md` and reports unexplored entry points. | One per artifact, each convergence round. |

**Put every round's `Agent` calls in one assistant message.** Calls in separate messages run
serially, and the whole point of the fan-out is that they do not.

**Each prompt is self-contained.** An agent cannot see this conversation. Give it the entry point,
the absolute `$RESEARCH_DIR`, and its `<ep-slug>.questions.md` contents — nothing more is needed,
because the contract lives in the file the agent reads.

## Output

Per entry point `<ep-slug>`, two files in `$RESEARCH_DIR/`:

| File | Purpose |
|---|---|
| `<ep-slug>.questions.md` | Grill-phase questions the explorer must answer. |
| `<ep-slug>.md` | Scannable refactor-oriented write-up. Every claim links to `path:line`. |

After all agents finish:

| File | Purpose |
|---|---|
| `INDEX.md` | One-line summary + links per entry point. |

## Procedure

1. **Resolve task slug.** User's task description, kebab-case, max 40 chars. Save as `TASK_SLUG`.
2. **Resolve `<notes-dir>` and `$RESEARCH_DIR`** (see `dive:SKILL.md` "Output location"). Create `$RESEARCH_DIR` if missing.
3. **Check for prior runs.** If `$RESEARCH_DIR/INDEX.md` exists, ask the user: *append*, *overwrite*, or *bail*. Never silently overwrite.
4. **Generate question lists** — one `$RESEARCH_DIR/<ep-slug>.questions.md` per entry point. Follow `references/ref-grill.md`. These are questions the explorer must answer, not questions for the user.
5. **Spawn one `explorer` per entry point, all in one message.** Give each: the entry point, the absolute `$RESEARCH_DIR`, and the contents of its `<ep-slug>.questions.md`.
6. **Wait for all explorers to finish.**
7. **Run the convergence loop** — `references/ref-converge.md` — until research converges.
8. **Write** `$RESEARCH_DIR/INDEX.md` (template below).
9. **Append worklog entry** to `<notes-dir>/worklog.md` if it exists.
10. **Print** the research dir path. Suggest `/dive workflow` to add the navigable TS pseudocode + bindings layer.

## INDEX.md

Write `$RESEARCH_DIR/INDEX.md` so the architector finds each artifact at a glance:

```markdown
# Research index — <task slug>

Generated: <ISO date>

| Entry point | Slug | Artifacts | Summary |
|---|---|---|---|
| `src/server/index.ts` | server-index | [md](server-index.md) · [questions](server-index.questions.md) | HTTP request lifecycle from router to response |
| `HandleRequest` | handle-request | [md](handle-request.md) · [questions](handle-request.questions.md) | Dispatch + middleware chain |

**Workflow layer:** run `/dive workflow` to add `../workflows/<ep-slug>/<ep-slug>.workflow.ts` + `../workflows/flows.json` (render with `/flow-map`).
```

If the `workflow` route already ran, add its `[workflow]` / `[flows.json]` links to the table.
