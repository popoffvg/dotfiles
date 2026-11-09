# Claude routing ledger

For a named agent, read its definition and repeat its concrete `model` on the call;
omit `model` when the definition says `inherit`. Override that choice only for a
task-specific reason disclosed to the operator. For units with no named agent:

| Unit | Shape | Model |
|---|---|---|
| One tool call or short edit | inline | current |
| Needs the conversation and would flood it, and starts no agent | `subagent_type: "fork"` | inherited, always |
| Starts agents or needs a model other than the current one | named agent with `model` and a self-contained prompt, or run the loop inline | the model of the row below that fits the work |
| Bounded audit, summary, triage, or lookup | one subagent | `haiku` |
| Independent bounded reading units | one subagent per unit, launched together | `haiku` |
| Writes source or judges a design | inline, or one subagent for heavy reading | current inline; `sonnet` in a subagent, `opus` after a cheaper run failed |

A fork MUST NOT start agents. A fork prompt that names `sonnet`/`haiku`, an agent type, or a loop that starts agents (`/code impl`, a gate wave) runs every nested step on the parent model; a PreToolUse hook denies it.

Use Claude's Agent tool and `subagent_type` for named agents. Parallel writers get
disjoint write sets; use `isolation: "worktree"` when they would share a path.

For `run_in_background: true`, name an absolute output file in the prompt, have the
agent write its deliverable there and return the path. Await its completion signal
or the available task-output tool before collecting that file.
An idle notification alone carries no report body. A failed bounded `haiku` result
re-runs as one unit on `sonnet`. Other deficient units retain their routed model
unless the writing/design row or a disclosed named-agent override applies.

Before reporting an actual model, verify `message.model` in that agent's JSONL under
`~/.claude/projects/<project-dir>/<session-id>/subagents/`; the orchestrator transcript
does not prove which model its minions ran.
