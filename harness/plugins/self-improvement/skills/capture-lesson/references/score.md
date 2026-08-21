# Score a session for the lessons it holds

Read the human-typed prompts of one session and return one score, one scope, and one line of reason. Decide nothing else — no lesson write-up, no recurrence verdict, no skill. Extraction happens later, in batch, in [[dream]]'s harvest.

`score-session.sh` feeds this file to the model verbatim as the rubric, so it is the single home for the bands. Edit here and both the scorer and the reader change together.

## What is being judged

Only the prompts the person typed, and only the ones past the watermark. That is a hard input contract, not a summary of what is convenient:

| Reaches the scorer | Never reaches the scorer |
|---|---|
| the text of each human prompt, in order | assistant turns, tool calls, tool results |
| — | the session's `ai-title` (the assistant wrote it) |
| — | transcript line numbers and timestamps |
| — | images, attachments, injected reminders, meta entries |

The last two rows are the easy ones to leak, because a human reader wants them. A scorer given the assistant's own title for the session starts scoring the assistant's summary instead of the user's words, and a lesson is only ever in the user's words.

The question for each prompt: **would this teach a colleague something that holds beyond the task it was said in?**

## Bands

| Score | The prompts hold | Example |
|---|---|---|
| 0–2 | nothing to keep — a request, a question, an approval, a choice made for this task only | "add a column for X", "yes go ahead", "what does this do" |
| 3–5 | a preference stated once, inseparable from this task's content | "call it `variantId` here", "put that file under `internal/`" |
| 6–8 | a correction or a stated convention that transfers — the rule survives without these files | "don't add Co-Authored-By", "always check the existing tools first", "use perl for multi-edits" |
| 9–10 | the same correction more than once in one session, or the user names it as a standing rule | "I told you already — never…", "from now on, always…", "remember this" |

A session with several prompts takes the **highest** band any one prompt reaches. One real correction is not diluted by twenty ordinary requests around it.

Score `6` is the keep threshold: at or above it the transcript is copied into `lessons/<scope>/` so the evidence outlives Claude Code's own pruning, and `/dream` harvests it later. Below it, only the score and the reason are recorded.

## Scope

| Scope | The rule is true | Goes to |
|---|---|---|
| `global` | away from this repo — it corrects behaviour, tone, or method | `~/.claude/skills` |
| `project` | of the repos that were in context — their order, tooling, layout, conventions | `<repo>/.claude/skills` |
| `none` | nowhere; use whenever the score is below 6 | nothing |

Pick the scope of the prompt that set the score, not an average of the session.

## Reason

One line, under 120 characters, naming the correction — not the topic of the session. "user rejected per-language rules, wants language-agnostic layout" is a reason; "discussion about code style" is not. This line is what the TUI shows and what `/dream` triages on, so it has to carry the lesson in one glance.

## Output contract

Exactly one line of JSON on stdout, nothing before or after it — no preamble, no code fence, no explanation:

```
{"score": 8, "scope": "global", "why": "user rejected per-language rules, wants language-agnostic layout"}
```

`score` is an integer 0–10. `scope` is one of `global`, `project`, `none`. `why` is the one line above.

A malformed line is recorded as score 0 with the reason `unparseable verdict`, and the watermark still advances — a session that cannot be judged is dropped rather than retried forever.
