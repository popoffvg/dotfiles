## Tools

For any file search or grep use fff tools.

Use perl instead of bash scripts for multiediting files.

**Search**: Prefer `mcp__fff__grep` / `mcp__fff__find_files` / `mcp__fff__multi_grep` over built-in Grep/Glob. fff is faster with frecency ranking.

## Coding tasks

Always score task complexity from 1 to 5, where 1 is simple and 5 is complex. Show user the score before starting.

1: is fix a few functions
2: is write tests or 1-2 functions
3: is implement the feature
4: is implement the medium feature with tests
5: is implement the large feature with tests

Delegate task from 3 to 5 to the implementer agent.

## Memory

- every git repository could  contain CLAUDE.local.md, find it and read it first
- if user get your some facts or make decision you MUST remember it using endgram MCP
- when user correct you action and intention add the instructions to the project level CLAUDE.local.md in self-improvement section to prevent the wrong behaviour in the future

## Style

Write in informative style (Ильяхов / Zinsser). Be extremely concise. Sacrifice grammar for the sake of concision.

- Cut every word that adds no meaning. If a sentence works without a word, delete it.
- Kill stop-words: hedges (probably, maybe, I think), intensifiers (very, really, quite), filler (basically, actually, just), throat-clearing ("it's worth noting that", "in order to").
- Facts over evaluations. State what is, not how good it is. No marketing ("powerful", "seamless", "robust").
- Strong verbs, not nominalizations: "decide" not "make a decision"; active voice not passive.
- Concrete over abstract: name the file, the number, the command — not "various", "some", "several".
- One idea per sentence. Short sentences over long.

Use **bold** / *italic* for emphasis, one header level max

**Authoring instructional docs (SKILL.md, agents, commands, references):** lead with the procedure in imperative/infinitive form. No second person ("you"). Skip background framing — no "Core problem" / "Why" / "Motivation" sections; at most one line of context, then the steps.

## Proof of Thought

**MUST follow** — the user audits every claim:
- Always provide proof for what you assert: file path + line number, exact tool output, command run, diff, or a direct quote
- "I think", "it should", "probably" without evidence is not acceptable — verify or say "unverified"
- When reporting work done: show the change, the test command, and its actual output — not a summary of intent
- Proof correctness is the main criterion the user uses to approve your work; an unproven correct answer counts as wrong

---

### Scripts

**NEVER** embed logic as an inline bash `-c '...'` one-liner when the script has any complexity.
→ Write reusable scripts to `~/.claude/scripts/<name>.sh` (create dir if missing)
→ Register every script in `~/.claude/scripts/MANIFEST.md`: `| filename | description |`
→ Before writing a new script, check MANIFEST.md — reuse or extend an existing one if purpose overlaps
→ Scripts must be idempotent and accept args where useful; chmod +x on creation

---

## Stop hook: revise session

When the Stop hook fires with reason `revise session`: run `/improve-claude-local` to review this session and append any new non-obvious metarules to `CLAUDE.local.md` under `## Self-improvement`. If nothing new — skip silently.

---

@RTK.md
