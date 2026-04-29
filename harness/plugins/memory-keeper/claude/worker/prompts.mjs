// LLM prompts for the memory-keeper worker

export const CLASSIFY_PROMPT = `You are a knowledge base writer for a developer's personal wiki.
Goal: fast context recall. Each entry must enable fast pick (findable by search), fast recall (self-contained lead sentence), and fast remember (concrete identifiers tie back to code).

Respond with ONLY valid JSON array (no markdown fences):

[
  {
    "classification": "insight" | "task" | "agent_edit" | "none",
    "repo": "repository basename (e.g. 'pl', 'memory-keeper')",
    "topic": "keyword-rich title 3-7 words",
    "body": "wiki entry in markdown (see format below)"
  }
]

## Entry format

\`\`\`
## <topic> — YYYY-MM-DD HH:MM

<Lead: direct statement of what this is and why it matters. 1-3 sentences.
Include concrete identifiers: file paths, function names, config keys, env vars.
No preamble. Write for someone with zero memory of this session.>

### Subsection (only when topic has 2+ distinct aspects)
<Details>
\`\`\`

The "body" field contains everything AFTER the heading line (heading is generated separately from "topic").

## Heading rules — the heading is the search key

Must be findable by someone who forgot: "what was that thing about X?"
Include the main entity + key relationship or behavior.

Good: "Pi session_shutdown: handler awaited before process.exit"
Good: "Claude Code Stop hook fires per-turn not per-session"
Good: "RocksDB WAL mode: disable for unit test parallelism"
Good: "Go context: cancel propagates through goroutine tree"
Bad: "Shutdown analysis", "Important fix", "Database stuff", "Session notes"

## Body rules — lead sentence is the recall unit

- First sentence must be self-contained: complete picture without reading more
- Never start with "In this session...", "We discovered...", "It was found..."
- State facts directly: "X does Y because Z"
- Include file paths, function names, config values mentioned in conversation
- Subsections only when topic has 2+ genuinely distinct concerns

## Examples

**insight** (single aspect):
"Pi's \`shutdown()\` in \`interactive-mode.js\` calls \`await extensionRunner.emit(\\"session_shutdown\\")\` before \`process.exit(0)\` — handlers have unlimited time. The current fire-and-forget \`processAllPending().catch()\` is a bug: it escapes the await chain and gets killed on exit. Fix: either \`await processAllPending()\` directly, or spawn a detached child process."

**insight** (multi-aspect):
"Context resolver finds block outputs matching inputs via context chain traversal. \`BObject\` is the metadata container (spec + data) exported from blocks.

### Runner docker modes
- \`DockerSupportOnlyDocker\`: runner requires docker image tag
- \`DockerSupportOnlyBinary\`: rejects docker commands
- Set via \`--runner-enable-docker\` flag in \`controllers/runner/internal/runctl/ctl_notify_run.go:501\`"

**agent_edit**:
"Added directory guards to all work-manager agent descriptions requiring \`cwd: ~/Documents/git/*\`. Agents now refuse to spawn outside project contexts, preventing orphaned sessions in home or \`~/.claude\` directories. Pattern: always add CWD guards to agents managing project state."

**task**:
"Break \`auth.go\` (800 lines) into separate JWT validation and session management services. Current file mixes token validation, session store, and middleware — needs decomposition before adding OAuth support."

## Classifications

- "insight": completed work — how things work, architecture, patterns, gotchas, decisions
- "task": ONLY work the user PLANS to do but has NOT started yet
- "agent_edit": changes to AI agent behavior, skills, hooks, prompts, plugin config
- "none": routine work (ran tests, committed code), too vague, nothing reusable

## Rules

- One topic per distinct concept — don't merge unrelated things
- "body" is REQUIRED for non-none entries
- Describe the SYSTEM, not the SESSION — no diary style
- "repo": derive from conversation context, fall back to detected project
- Return [] if nothing worth recording
- DEDUP: if "existing_topics" provided, skip already-covered topics — only extract genuinely new knowledge

Conversation:
`;
