# Prompt requirements

Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices and the per-model pages linked from it.

## Elements

| Element | Why it matters | Question when missing | Required |
|---|---|---|---|
| Goal / task | Claude follows instructions literally. "Suggest changes" gives suggestions, "change the function" gives edits. One verb plus one object. | What exact result do you want at the end? Which verb: write, classify, edit, review, extract? | yes |
| Audience | Sets depth, vocabulary, and what to leave out. | Who reads the output? What do they already know? | if a human reads the output |
| Context | Claude knows none of your norms. The reason lets it generalize ("no ellipses — a TTS engine reads the text"). | Why does this task exist? What happens with the output next? | yes |
| Input data | Named, tagged inputs stop Claude from mixing data with instructions. Long data goes above the instructions. | What does Claude receive each run? Size, format, one item or many, from where? | yes |
| Output format and length | Say what to do, not what to avoid ("flowing prose", not "no markdown"). The style of the prompt leaks into the output. Prefill is gone on 4.6+: use XML output tags or structured outputs. | Show one ideal output. Length? Markdown, JSON, plain text? Fixed sections? | yes |
| Constraints | A rule with no reason gets applied too wide or too narrow. Keep hard limits apart from preferences. | What must never happen? Why? What does it cost if it happens? | yes |
| Success criteria | Lets Claude check itself and lets you judge the output. | How do you know the output is good? What makes you reject it? | yes |
| Edge cases | The default when input is empty, off-topic, or unclear: ask, state an assumption and go on, or return a fixed marker. An unattended run cannot ask. | What happens when the input is bad or the task is unclear? Can Claude ask, or must it decide alone? | yes |
| Target model and effort | A technique measured on one model must be checked again on another. `budget_tokens` is gone on 4.7+: use `effort`. | Which model and effort? Thinking on? API, Claude Code, or chat? | if API or a new model |
| Tools / environment | Set the action default (act or wait for instructions), the actions that need confirmation (destructive, visible to others), parallel calls, scope limits. | Which tools exist? What can Claude do without asking? What is irreversible? Does a human watch? | if agentic |
| Tone / style | Current models write short, direct prose by default. Strong anti-formatting rules over-suppress. Say when lists or bold are OK. | Formal or casual? Short or full? Whose voice? | no |
| Examples | The strongest lever for format, tone, and structure. 3–5, varied, one hard case, each in `<example>` with a short rationale. | Can you give 3 real input/output pairs, one of them hard? | no, advised |
| Role | One specific sentence focuses tone and domain ("senior Python reviewer for a fintech team"). | Who should Claude act as, with what expertise? | no |
| Reasoning steps | Number the steps when order or completeness matters. For long documents: quote the relevant parts in `<quotes>` first, then answer. Extra thinking adds latency. | Is there a fixed order of steps? Show reasoning or only the result? | no |
| State across turns | Long tasks need structured state (`tests.json`), progress notes, git checkpoints, and "finish the whole task". | Does the task span many turns or context windows? Where is progress saved? | if agentic, long |

## Anti-patterns

- A vague verb: "help with", "look at", "handle".
- A ban with no positive target.
- A rule the receiver can misapply, with no reason. A reason on an obvious rule adds words and changes nothing.
- A success criterion that repeats an instruction. Keep the check; cut the step.
- Prose that describes an output shape. Show a filled-in skeleton.
- A step the receiver can work out from the success criteria.
- Shouting: ALL CAPS, "CRITICAL", "You MUST ALWAYS". Current models over-trigger on it.
- Anti-laziness nudges copied from old prompts ("if in doubt, use the tool").
- Sections that contradict each other (the system says "be brief", the examples are long).
- Examples that all look alike — Claude copies the pattern by accident.
- Instructions below a long document instead of above it.
- Data, instructions, and examples with no tags around them.
- Prefill for format.
- No audience, no success criteria, no rule for the unclear case.
- Metaphors and flourish in the prompt itself.
- A sentence that changes no behaviour.
- Context the receiver already has: file contents, repo facts, conversation history, rules from its CLAUDE.md. Point to the source; do not copy it.

## Skeleton

System prompt:

```
<role>One or two sentences: who Claude is, the domain, the expertise.</role>
<context>Why the task exists, who reads the result, what happens next.</context>
<instructions>
  Numbered steps when order matters. Each hard rule with its reason.
  Edge cases: what to do when the input is empty, unclear, or out of scope.
</instructions>
<tools>Agentic only: action default, actions that need confirmation, parallel calls, scope.</tools>
<output_format>Exact structure, tags or schema, length, tone, when lists are OK.</output_format>
<success_criteria>How a good output is judged; what gets it rejected.</success_criteria>
<examples>
  <example><input>…</input><output>…</output><rationale>why it is correct</rationale></example>
</examples>
```

User turn:

```
<documents>
  <document index="1"><source>name</source><document_content>…</document_content></document>
</documents>
<input>the data for this run</input>
The task sentence, short, at the very end.
```

Long data first, task last. Keep tag names the same across prompts. Format the prompt the way you want the output formatted.
