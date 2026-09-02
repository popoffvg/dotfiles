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

> **Style**: `harness-dev:text-style` — the house shape of every artifact this skill writes.

## The files this skill owns

| File | Holds |
|---|---|
| `references/ref-artifact.md` | The artifact contract — the 6-step chain and the `.md` section order. Both agents read it; nothing here restates it. |
| `references/ref-grill.md` | The grill phase — how `<ep-slug>.questions.md` is generated. |
| `references/ref-converge.md` | The convergence loop — grade, discover, re-spawn, stop. |

## The two agents

You orchestrate; the agents do the reading. Both read `ref-artifact.md` themselves — **never paste
the artifact contract into a prompt.**

| Agent | Does | Spawned |
|---|---|---|
| `wm:explorer` | Writes one `<ep-slug>.md` for one entry point. | One per entry point, first round and every gap-filling round. |
| `wm:explore-critic` | Grades one `<ep-slug>.md` and reports unexplored entry points. | One per artifact, each convergence round. |

**Spawn both exactly as `dive:SKILL.md` § Parallel subagents states** — the prefixed
`subagent_type`, `model: "sonnet"`, and the label in `name`. That is the one home for the spawn
form, and it holds for the first round and every later round.

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
| `INDEX.md` | One-line summary + links per entry point, in `$RESEARCH_DIR/`. |
| `<notes-dir>/GLOSSARY.md` | The project's ubiquitous language, merged from every artifact's `## Terms`. See § Glossary. |

## Procedure

1. **Resolve task slug.** User's task description, kebab-case, max 40 chars. Save as `TASK_SLUG`.
2. **Resolve `<notes-dir>` and `$RESEARCH_DIR`** (see `dive:SKILL.md` "Output location"). Create `$RESEARCH_DIR` if missing.
3. **Check for prior runs.** If `$RESEARCH_DIR/INDEX.md` exists, ask the user inline — one question, `AskUserQuestion` — *append*, *overwrite*, or *bail*. Never silently overwrite.
4. **Generate question lists** — one `$RESEARCH_DIR/<ep-slug>.questions.md` per entry point. Follow `references/ref-grill.md`. These are questions the explorer must answer, not questions for the user.
5. **Spawn one `wm:explorer` per entry point, all in one message.** Give each: the entry point, the absolute `$RESEARCH_DIR`, and the contents of its `<ep-slug>.questions.md`.
6. **Wait for all explorers to finish.**
7. **Run the convergence loop** — `references/ref-converge.md` — until research converges.
8. **Merge the glossary** into `<notes-dir>/GLOSSARY.md` — § Glossary below.
9. **Write** `$RESEARCH_DIR/INDEX.md` (template below).
10. **Append worklog entry** to `<notes-dir>/worklog.md` if it exists.
11. **Print** the research dir path and the count of glossary rows the user approved. Suggest `/dive workflow` to add the navigable TS pseudocode + bindings layer.

## Glossary

Research is where the project's words are found, so research is where `<notes-dir>/GLOSSARY.md` starts. Each artifact's `## Terms` table names the words of one path; this step turns the whole set into one language. There is no second glossary in `$RESEARCH_DIR/` — the notes-dir file is the one home, and `arch` keeps writing to it through the spec phase (`arch:examples/glossary.md`).

1. **Collect** every `## Terms` row from every `$RESEARCH_DIR/<ep-slug>.md`.
2. **Merge them with the `terms` skill.** Load it and run its cluster-and-canonicalize pass over the collected rows. It picks one canonical word per concept, folds the rest into Avoid, and reports a collision — one word carrying two meanings — as two concepts instead of one. Do not restate its algorithm here.
3. **Diff against the existing file.** A row whose Term is already in `<notes-dir>/GLOSSARY.md` with the same meaning is not a change. What remains is the change set: new terms, reworded definitions, and collisions.
4. **Get the user's approval on the change set** — `code:ref-subcommand-rules.md` § Glossary owns how. A collision goes to the user as a question, never as a merge you picked.
5. **Write the approved rows** into `<notes-dir>/GLOSSARY.md` in the `arch:examples/glossary.md` shape. Leave **Kind** empty — the spec phase types each term against the brick roster. Drop the rejected rows; they do not return next run.

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
