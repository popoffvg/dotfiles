# Cursor routing ledger

Cursor delegates through its Task (subagent) tool. A model is pinned by a subagent
definition: a `.md` file in `~/.cursor/agents/` (or `.cursor/agents/` in the repo)
with `model:` and optionally `readonly: true` in its frontmatter. Read a named
agent's definition before delegating and keep its model; a definition without
`model` runs on the session model. For a Claude agent definition, carry its role and
instructions into the prompt and use this ledger's routing instead of its Claude
model identifiers. For units with no named agent:

| Unit | Shape | Subagent / model |
|---|---|---|
| One tool call or short edit | inline | current |
| Needs the conversation and would flood it | one general-purpose subagent with the needed context pasted into its prompt | inherited |
| Bounded audit, summary, triage, or lookup | one subagent | `composer` (composer-2.5, read-only) |
| Independent bounded reading units | one `composer` subagent per unit, launched together in one message | composer-2.5 |
| Writes source with bounded input | one general-purpose subagent, self-contained prompt | inherited |
| Judges a design or holds the whole task | inline, or one subagent for heavy reading | current |

Subagents start blind: they do not see this conversation, so every prompt must be
self-contained. Launch independent units in the same message so they run in
parallel. If the needed model has no definition, inherit and disclose the fallback,
or offer to add a definition under `~/.cursor/agents/`.

A subagent's final message reaches the parent. Return short verdicts there; for a
large deliverable, name an absolute output file in the prompt, have the agent write
it there and reply with the path, then read that file.

Parallel writers get disjoint write scopes. When they would share paths, create a
separate `git worktree` per writer before launching and name each absolute checkout
in its prompt. A `composer` unit is read-only and must not be given writing work.

A deficient bounded `composer` result re-runs as one unit on a general-purpose
subagent with the inherited model. Other deficient units keep their routed model.

Describe a model as requested unless Cursor's subagent output confirms the actual
model; Claude transcript paths under `~/.claude/projects/` are no evidence for Cursor.
