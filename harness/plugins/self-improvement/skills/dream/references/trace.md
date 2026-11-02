# Trace the corrections of one session to their cause

You read one Claude Code session in which a person corrected the agent. For each correction, find what the agent did, which input it followed when it did it, and who wrote that input. You give evidence. You do not judge whether a lesson exists.

## What you get

- The transcript path, and the subagent transcript dir.
- The prompts the person typed, each with its transcript line number and timestamp.

A transcript is JSONL, one event per line. Lines are long. Use `Grep` on the transcript with a short literal string, then `jq` on one line: `jq -c 'select(input_line_number == N)' <file>`. Use `jq -r` with `input_line_number` ranges to read the assistant text and tool calls before a correction. A subagent was started by an `Agent` or `Task` tool call in the parent. Its transcript is `<dir>/agent-<id>.jsonl`. Read the prompt the parent gave it.

## What a correction is

A prompt where the person says that an action of the agent was wrong, or states how the work must be done after the agent did it differently: "why", "don't", "not needed", "wrong", "revert", "I told you", a rewritten instruction, an interrupt followed by a new instruction. A request for new work, a question about code, and an approval are not corrections.

## For each correction

1. **Defect.** The agent action that the correction is about: a tool call, an edit, a text claim. Give the transcript line and the agent (`main` or the subagent id).
2. **Input followed.** The text that the agent obeyed when it made the defect. Quote it verbatim and name where it is: a `file:line` the agent read, a line of the parent's prompt to a subagent, a review finding, a skill rule, or the person's own earlier words. Never guess an input you did not read in the transcript.
   - When a subagent wrote the code, open its transcript. List the files it read before the edit: the TODO, its agent half (`TODO-N.agent.md`), the spec, the ADRs, `PATTERNS.md`, the parent's prompt. Search each one for a sentence that prescribes the defect: the primitive, the step, the shape. Check this before you write `none`.
   - Write `none` only after that search, and say which files you searched.
   - Follow a copy to its source. A TODO, spec, or `PATTERNS.md` line that restates an ADR Property, or names one (`ADR-0115 P8`), is a copy. Open the ADR and quote the Property. The input is the Property, and the producer is the step that wrote the ADR. Stop when a line names no source.
3. **Producer.** Who wrote that input, at two levels:
   - `producer`: the step or person in this session, for example "the TODO-10 author" or "the review gate".
   - `producer_harness`: the harness component whose rules produce that kind of input. A TODO or its agent half comes from the wm `arch` skill (`sub-todo.md`). An ADR comes from the `adr` skill. A review finding comes from the named gate agent. An orchestrator prompt comes from the skill that ran the orchestrator. `model-default` when the input is `none`. `person` when the person wrote it.
4. **Hop mutation.** When the input passed through more than one agent (a review finding, then the orchestrator's prompt, then a subagent), compare the text at each hop. If a suggestion or nit arrived as an order, or a condition was dropped, quote both forms. Otherwise `null`.
5. **Snippets.** The smallest text that shows the defect (code, a command, a sentence the agent wrote), and the form the person wanted, from a later edit or from the person's words. Keep each under 40 lines. Write `""` when the transcript has no such text.

## Group by cause

Two corrections share a cause when the same input, or the same missing input, led to both defects. Return one cause per group, with every correction in it. A session with no correction returns an empty list.

Never group by the complaint. "Too complex" about a mutex and "too complex" about a recursion are two causes when two different inputs led to them. A group whose input is `none` holds only corrections about the same kind of defect.

Return only the JSON the schema asks for.
