# Dropped skills

Every skill removed from this repo, what it did, and how to read it back.

Recover one with `git show <commit>^:<path>` — the commit is the one that removed it, so the
parent still has the file. The commit message says why the whole group went.

| Skill | What it did | Commit | Path |
|---|---|---|---|
| `act-local-github-actions-testing` | Run and debug GitHub Actions locally with `act`, including job filtering, secrets injection, event payload sim | `4f754ed6` | `harness/claude/skills/act-local-github-actions-testing/SKILL.md` |
| `clipboard-sandbox` | Use when copying content to the clipboard for the user (pbcopy / xclip / clip.exe / wl-copy), e.g. handing a c | `b759ad85` | `harness/claude/skills/clipboard-sandbox/SKILL.md` |
| `cmux-subagent` | This skill should be used when the user asks to "launch a subagent in cmux", "run claude in a new pane", "open | `c05b1fad` | `harness/claude/skills/cmux-subagent/SKILL.md` |
| `codebase-analyzer` | Router skill for codebase analysis. Launches one implementation analyzer subagent and produces one evidence-ba | `e5feab8e` | `harness/claude/skills/codebase-analyzer/SKILL.md` |
| `debug-oauth-idp-errors` | Debugging an OAuth2/OIDC identity-provider rejection — invalid_scope, invalid_client, invalid_redirect_uri, "r | `0267e653` | `harness/claude/skills/debug-oauth-idp-errors/SKILL.md` |
| `discussion-scheme` | — | `28f9fdd4` | `harness/claude/skills/discussion-scheme/SKILL.md` |
| `document-the-union-a-value-is-written-under` | Use when writing or reviewing the sentence that tells a reader what a status value means — an enum's doc comme | `52887eb6` | `harness/claude/skills/document-the-union-a-value-is-written-under/SKILL.md` |
| `enforce-a-broken-ban-mechanically` | Use when about to fix an agent's misbehaviour by adding or sharpening a rule in its prompt, and the prompt ALR | `b759ad85` | `harness/claude/skills/enforce-a-broken-ban-mechanically/SKILL.md` |
| `find-skills` | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for  | `b759ad85` | `harness/claude/skills/find-skills/SKILL.md` |
| `gh-test` | Test GitHub Actions locally using `@kie/act-js` (CLI + API), including event simulation, job-level runs, secre | `4f754ed6` | `harness/claude/skills/gh-test/SKILL.md` |
| `git-workflow` | This skill should be used when asked about branching, committing, PRs, or the end-to-end Git development flow. | `5774c0b9` | `harness/claude/skills/git-workflow/SKILL.md` |
| `gitnexus-cli` | Use when the user needs to run GitNexus CLI commands like analyze/index a repo, check status, clean the index, | `e5feab8e` | `harness/claude/skills/gitnexus-cli/SKILL.md` |
| `gitnexus-debugging` | Use when the user is debugging a bug, tracing an error, or asking why something fails. Examples: \"Why is X fa | `e5feab8e` | `harness/claude/skills/gitnexus-debugging/SKILL.md` |
| `gitnexus-exploring` | Use when the user asks how code works, wants to understand architecture, trace execution flows, or explore unf | `e5feab8e` | `harness/claude/skills/gitnexus-exploring/SKILL.md` |
| `gitnexus-guide` | Use when the user asks about GitNexus itself — available tools, how to query the knowledge graph, MCP resource | `e5feab8e` | `harness/claude/skills/gitnexus-guide/SKILL.md` |
| `gitnexus-impact-analysis` | Use when the user wants to know what will break if they change something, or needs safety analysis before edit | `e5feab8e` | `harness/claude/skills/gitnexus-impact-analysis/SKILL.md` |
| `gitnexus-pdg-query` | Use when querying or extending GitNexus's PDG control/data-dependence surface (the `pdg_query` MCP tool, CDG/R | `e5feab8e` | `harness/claude/skills/gitnexus-pdg-query/SKILL.md` |
| `gitnexus-pr-review` | Use when the user wants to review a pull request, understand what a PR changes, assess risk of merging, or che | `e5feab8e` | `harness/claude/skills/gitnexus-pr-review/SKILL.md` |
| `gitnexus-refactoring` | Use when the user wants to rename, extract, split, move, or restructure code safely. Examples: \"Rename this f | `e5feab8e` | `harness/claude/skills/gitnexus-refactoring/SKILL.md` |
| `gitnexus-taint-analysis` | Use when working on, reviewing, or extending GitNexus's CFG/taint/PDG subsystem (the `--pdg` layers), or when  | `e5feab8e` | `harness/claude/skills/gitnexus-taint-analysis/SKILL.md` |
| `go-debug` | Reference guide for interactive Go debugging with Delve (dlv) — breakpoints, stepping, variable inspection, go | `bd3360bf` | `harness/claude/skills/go-debug/SKILL.md` |
| `go-logger-analyzer` | Structured analysis of JSON log files from Go loggers (zap, logrus, zerolog) — statistics, error patterns, fie | `bd3360bf` | `harness/claude/skills/go-logger-analyzer/SKILL.md` |
| `go-modify` | Gopls-validated Go code changes — renames, refactoring, multi-file coordinated changes with reference tracking | `bd3360bf` | `harness/claude/skills/go-modify/SKILL.md` |
| `go-test-debug` | Debug complex Go test failures — flaky tests, race conditions, deadlocks, panics, timeouts, nil pointer derefe | `bd3360bf` | `harness/claude/skills/go-test-debug/SKILL.md` |
| `go-understanding` | Comprehensive analysis of unfamiliar Go packages — structure, public API, dependencies, coding patterns. Use w | `bd3360bf` | `harness/claude/skills/go-understanding/SKILL.md` |
| `herdr` | Drive the herdr terminal workspace from a Claude Code session — open a program in a pane beside the user (heli | `c05b1fad` | `harness/claude/skills/herdr/SKILL.md` |
| `idea` | This skill should be used when the user says "idea", "I have an idea", "what if we", "we could", "it would be  | `d5556398` | `harness/claude/skills/idea/SKILL.md` |
| `identity-bind-before-mint` | Use when implementing or reviewing "log in as / bind this login to an existing user / map an external id to an | `0267e653` | `harness/claude/skills/identity-bind-before-mint/SKILL.md` |
| `inline-review-todos` | Place PR/code-review comments as inline TODO markers in the file each comment is on, at its line, not in a cen | `5774c0b9` | `harness/claude/skills/inline-review-todos/SKILL.md` |
| `mise` | This skill should be used when the user mentions "mise", "mise run", "mise task", "copy-logs", "dump-db", "rep | `b759ad85` | `harness/claude/skills/mise/SKILL.md` |
| `native` | Rewrite text so it reads like a native English speaker wrote it, and fix grammar, spelling, articles, preposit | `070d0d82` | `harness/claude/skills/native/SKILL.md` |
| `no-literal-home-path-in-stowed-files` | — | `20b523fa` | `.claude/skills/no-literal-home-path-in-stowed-files/SKILL.md` |
| `note` | Capture a human note — a todo, a thought, a reminder, or an open question — as one file per note in `.note/per | `d5556398` | `harness/claude/skills/note/SKILL.md` |
| `notify-me` | Send a desktop notification to the user when they ask to be notified upon task completion. Use this skill when | `c05b1fad` | `harness/claude/skills/notify-me/SKILL.md` |
| `oidc-identity-claim-match` | When matching or authorizing users by identity in an OIDC/SSO login flow — admin/allowlists, role assignment,  | `0267e653` | `harness/claude/skills/oidc-identity-claim-match/SKILL.md` |
| `parallel-agent-tree-guard` | Guard against parallel subagents straying outside their assigned files when they share one working tree. Use w | `c05b1fad` | `harness/claude/skills/parallel-agent-tree-guard/SKILL.md` |
| `plannotator-compound` | > | `c4e229c2` | `harness/claude/skills/plannotator-compound/SKILL.md` |
| `quiet-teammate-idle-notifications` | Two rules for an idle_notification from a background or named subagent (idleReason "available"). First, keep q | `c05b1fad` | `harness/claude/skills/quiet-teammate-idle-notifications/SKILL.md` |
| `reask-in-prose` | Use when the user rejects an AskUserQuestion tool call and replies "reask" (or similar). Re-ask the same clari | `d5556398` | `harness/claude/skills/reask-in-prose/SKILL.md` |
| `reflection-completeness-test` | Use when writing a test that guards against a struct gaining a new field a mutator/merge/overlay/serializer me | `52887eb6` | `harness/claude/skills/reflection-completeness-test/SKILL.md` |
| `revert-only-your-own-edits` | Use before running git restore, git checkout --, git stash, or any bulk revert to undo an experiment you ran ( | `5774c0b9` | `harness/claude/skills/revert-only-your-own-edits/SKILL.md` |
| `sandbox-write-follows-symlinks` | Use when a Bash write inside a project directory fails with "Operation not permitted" / EPERM — a shell redire | `b759ad85` | `harness/claude/skills/sandbox-write-follows-symlinks/SKILL.md` |
| `single-pass-find` | Use when writing or reviewing a find-then-use flow — a lookup/find/search method and its caller — to avoid red | `52887eb6` | `harness/claude/skills/single-pass-find/SKILL.md` |
| `stop-a-gate-that-oscillates` | Use when an automated review loop — a lint/name/comment critic, a CI auto-fixer, a linter with competing rules | `52887eb6` | `harness/claude/skills/stop-a-gate-that-oscillates/SKILL.md` |
| `test-github-actions` | Run and debug GitHub Actions locally before pushing — with `act` (CLI) or `@kie/act-js` (programmatic API), in | `4f754ed6` | `harness/claude/skills/test-github-actions/SKILL.md` |
| `the-step-that-knows-the-outcome-owns-the-row` | Use when more than one stage of a pipeline appends rows, events, or status records to a shared store keyed the | `52887eb6` | `harness/claude/skills/the-step-that-knows-the-outcome-owns-the-row/SKILL.md` |
| `tmux-subagent` | This skill should be used when the user asks to "launch a subagent in tmux", "run claude in a new pane", "open | `c05b1fad` | `harness/claude/skills/tmux-subagent/SKILL.md` |
| `todo-fix` | > | `d5556398` | `harness/claude/skills/todo-fix/SKILL.md` |
| `typed-edge-ordering` | Use when implementing or reviewing a topological sort, dependency ordering, layering, or DAG traversal over a  | `52887eb6` | `harness/claude/skills/typed-edge-ordering/SKILL.md` |
| `verify-source-at-pinned-ref` | Debugging or fixing behavior that lives in a dependency, reusable CI action, submodule, or checked-out sibling | `5774c0b9` | `harness/claude/skills/verify-source-at-pinned-ref/SKILL.md` |
| `working-tree-removal-is-intent` | Use when a test or build breaks because an uncommitted working-tree change removed a guard, condition, branch, | `5774c0b9` | `harness/claude/skills/working-tree-removal-is-intent/SKILL.md` |
| `writing-gherkin-feature-files` | — | `4ef5a3d4` | `harness/claude/skills/writing-gherkin-feature-files/SKILL.md` |
| `writing-github-actions` | Write GitHub Actions workflows with proper syntax, reusable workflows, composite actions, matrix builds, cachi | `4f754ed6` | `harness/claude/skills/writing-github-actions/SKILL.md` |
| `zed-diagnostics-side-channel` | — | `20b523fa` | `.claude/skills/zed-diagnostics-side-channel/SKILL.md` |
