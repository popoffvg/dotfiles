# Cases

## 2026-07-28 — shell-grep habit carried back from an `ssh` session to the local repo

- **Repo:** `~/Documents/git/openclaw-infra`
- **Task:** Investigate why the `bash` tool was called in a pi session on the openclaw server, then trace where the resulting character count was used.
- **What I did:** The investigation started remote — `ssh openclaw 'grep -rln "character count" ...'`, which is correct, since the server is off the indexed tree. Then the question moved to the local repo and I kept using the shell: `grep -rn "character count" --include=*.ts .`, then `grep -rn "2081768022025658672" .`, then `grep -rn "length\|SHORT\|threshold" ...`, then `grep -rn "BODY_MIN" harness/extensions/blogs/`. Four local recursive shell greps.
- **Correction:** > ⚠️ Bash bypass detected — you used the shell where a dedicated tool exists.
  > - Recursive `grep -r` over the repo — prefer **mcp__fff__grep** (or **Grep** tool) for indexed search.
  >
  > Next time, prefer the dedicated tool: it is safer, cheaper, and the user audits these patterns.

  (PostToolUse hook, fired three separate times in one session. Not a human correction — hook output is treated as user feedback.)
- **Evidence:** The skill already existed at `~/.claude/skills/use-indexed-search-not-shell-grep/SKILL.md` and its `description` already covered "before running `grep -r`". It still did not fire, three times. The body's own exception clause — "or the path is outside the indexed tree" — is what licensed the first remote grep and left no instruction to switch back.
- **Ambiguous?** No — one right answer. The remote greps were correct and the local ones were not; the boundary is where the path lives, which is checkable per call. No trade-off.
- **Scope chosen:** global — row 1 of the Step 1 table. Worth teaching anyone new, and mixed remote/local sessions recur on any project with a server. Machine-anchored on the `fff` MCP tools, which the pre-existing body already names; falls back to the built-in `Grep` tool where `fff` is absent.
- **Rule written:** verdict — extended the existing skill instead of creating a new one. Added a paragraph: the outside-the-index exception does not carry over, so check where the path lives before each search rather than once per session. Widened the `description` with the mixed remote/local trigger, since the old wording described only the shell command and not the situation that produced the lapse.
