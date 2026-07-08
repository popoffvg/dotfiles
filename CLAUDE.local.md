# CLAUDE.local.md

## Self-improvement

<task-relevant when="removing/deselecting/moving a test (or whole package) from a CI job/lane to make a gate pass, and about to claim its coverage is preserved elsewhere">
Before asserting "another lane covers it", READ that lane's actual filter/config and confirm the test still runs there — don't assume. A test that ran in only one lane, dropped from that lane, now runs nowhere = a silently disabled test (exactly the "don't turn off tests" trap). Verify with the other job's real filter list; state "unverified" if you haven't checked.
</task-relevant>

<task-relevant when="the user refers to a file/guide/artifact they expect you to already have ('you have that', 'the guide I made', 'in scratchpad') and it's not in the obvious place">
Search the scratchpads before asking — including OTHER sessions' dirs, not just the current one. Session scratchpads live at `/private/tmp/claude-501/<project-hash>/<session-id>/scratchpad`; a branched or prior session's artifact sits under a sibling `<session-id>`. `find /private/tmp/claude-501/<project-hash> -ipath '*scratchpad*' -iname '<keywords>'`. Don't ask for clarification on an artifact that a quick cross-session scratchpad search would surface.
</task-relevant>

<task-relevant when="creating a NEW standalone model-invocable skill in dotfiles (e.g. extracting a reference into its own skill)">
Default to a loose `~/.claude` skill at `harness/claude/skills/<name>/SKILL.md` (stows to `~/.claude/skills`), NOT a plugin sibling skill under `harness/plugins/<plugin>/skills/`. Put it in the plugin only when the skill is plugin-coupled or the user says so. After moving, `mise run stow` to symlink it in.
</task-relevant>

<task-relevant when="a tracker skill (task-code-context, task-authoring, ticket) is invoked but the prompt targets local files ('fill section in files', points at a scratchpad path)">
Deliver by editing the local files, not the tracker. These skills default to an outward tracker write (Notion/Jira) — but 'in files' overrides that. Don't create/enrich tracker pages; add/fill the section in the scratchpad/spec files. Tracker writes are hard-to-reverse and outward-facing — confirm before defaulting to them.
</task-relevant>

<task-relevant when="authoring a skill/command/agent that runs in arbitrary project contexts (not the dotfiles repo)">
Reference the deployed `~/.claude/...` runtime paths, not the `harness/...` stow-source paths — the source path is meaningless when cwd isn't the dotfiles repo. The stow source is where you *edit* the file; the skill's *instructions* must point at `~/.claude`.
</task-relevant>

<task-relevant when="the user asks to allow/scope a permission for a specific plugin's behavior">
Plugins CANNOT declare `allow`/`deny` permissions — no `permissions` field in `plugin.json`; a plugin-shipped `settings.json` supports only `agent` + `subagentStatusLine` (verified vs code.claude.com docs). Ship the permission as a **PreToolUse hook** in the plugin that emits `{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",...}}` for the matching tool+path, else `exit 0` to defer. See `harness/plugins/self-improvement/hooks/allow-self-improve-writes.sh`. Don't default to the shared global `harness/claude/settings.json`.
</task-relevant>

<task-relevant when="asked to create a spec/corpus/project (mispec cold-start)">
"Create a spec for X" may mean skeleton-only. Run `mispec init` first, then confirm scope before authoring north-star/atoms — don't front-load foundational framing questions. The operator may want the bare scaffold and to set the north-star/scope themselves later.
</task-relevant>

<task-relevant when="creating or renaming mispec atom files (A-NNNN)">
Atom filenames embed the kind: `A-NNNN-<kind>-<slug>.md` (e.g. `A-0005-decision-decrements-via-event-log.md`), not `A-NNNN-<slug>.md`. Run `~/git/dotfiles/harness/claude/scripts/mispec-rename-kind.sh <atoms-dir> [<archive-dir> …]` to fix a batch — idempotent, uses `git mv`, skips already-kinded files and ones whose slug already equals the kind (e.g. `A-0011-goal.md`). A file moved by `mispec archive` is a plain rename (untracked at the new path), so `git mv` fails "not under version control" — use plain `mv` for those.
</task-relevant>

<task-relevant when="an open decision surfaces during a mispec resolve/review session">
Route it into the review-round record — a pointed note on the relevant atom's block, or a `[DECISION]` line under `## General comments` — so the operator resolves it with the same per-atom verdict pass. Don't open an `AskUserQuestion` chat prompt to settle it; the review record is the operator's decision channel.
</task-relevant>

<task-relevant when="adding a glossary to a SKILL.md-based skill">
Put it as `GLOSSARY.md` at the skill root, sibling to `SKILL.md`, and link it from SKILL.md — not as `references/ref-glossary.md`, even though the `ref-` taxonomy would otherwise fit.
</task-relevant>

<task-relevant when="diagnosing a missing/unavailable agent or plugin">
Check what's *enabled*, not what's on disk. Read `~/.claude/settings.json` `enabledPlugins` + `~/.claude/plugins/installed_plugins.json` `installPath` to find the *active* cache dir, then inspect that dir. The cache dir name need not match the source dir name. Verify the enabled→cache→agents chain before asserting something is missing.
</task-relevant>

<task-relevant when="local plugins won't load after moving or renaming a directory marketplace">
Updating `settings.json` `extraKnownMarketplaces.<name>.source.path` is NOT enough. Claude Code's runtime `~/.claude/plugins/known_marketplaces.json` caches the old `source.path` + `installLocation` and overrides settings; a stale `~/.claude/plugins/<name>` symlink may also point at the deleted source. Fix both paths, remove the broken symlink, then `/reload-plugins` (or re-add the marketplace via `/plugin`). `installed_plugins.json` / the cache refresh on re-add.
</task-relevant>

<task-relevant when="a marketplace.json source path won't resolve">
A `"source": "./X"` that doesn't resolve to a real dir/symlink yields an empty cache and zero agents/skills — silently, no error. Confirm the source path points at an existing plugin dir.
</task-relevant>

<task-relevant when="adding or editing a command in a lefthook hook">
lefthook does NOT expand `{root}` inside `run:` strings — a literal `{root}/...` path fails with "No such file". lefthook runs hooks from the repo root, so use a repo-root-relative path (`bash harness/scripts/x.sh`).
</task-relevant>

<task-relevant when="an autonomous explore/research flow could add a user-confirmation gate">
Don't gate on confirmation when a downstream loop already backstops wrong choices. Surface the chosen set in a log line; don't block on approval.
</task-relevant>

<task-relevant when="verifying a commit-triggered hook or other commit-gated behavior">
Don't make a real commit to test it — especially not on the default branch. Invoke the hook/script directly, use a throwaway worktree/branch, or ask first.
</task-relevant>

<task-relevant when="adding functionality that supersedes something existing">
Remove the superseded thing (and its coupled partners) and rewire references in the same change — don't leave it as a "fallback". Keep the old only if the user explicitly says so.
</task-relevant>

<task-relevant when="resolving a decision that picks among multiple scenarios/variants the operator enumerated">
Resolving one variant does NOT supersede its siblings — keep every scenario the operator named. Choosing an approach for one context (e.g. "user_id = preserve") doesn't authorize deleting the other enumerated case; the operator often wants both kept as a contrast (before/after, option A/B). Don't mark a sibling "abandoned" unless told. This is the carve-out to the supersede-and-remove rule above: a sibling variant is not a superseded thing.
</task-relevant>

<task-relevant when="asked to build or improve something for X">
Deliver it for all of X; don't silently narrow to one subsection unless told to.
</task-relevant>

<task-relevant when="documenting a module/folder/skill's structure or intent">
Write `CLAUDE.md` in that folder, not `README.md`. Per-folder docs are CLAUDE.md here.
</task-relevant>

<task-relevant when="adding or editing a subcommand in a router skill (SKILL.md with a subcommand table)">
Every subcommand needs its own `references/<subcommand>.md` (reuse an existing one if it already covers the sub) — add the table row AND ensure the reference file exists in the same change. Don't leave the reference column as `(self)` or inline-only (except `help`, which is the SKILL itself); that's an incomplete subcommand. ALSO update the companion `*-help` command (`harness/plugins/<plugin>/commands/<router>-help.md`) — it holds a SECOND verbatim copy of the subcommand table that silently drifts; add the row there too, and to the SKILL's frontmatter `description` subcommand list.
</task-relevant>

<task-relevant when="adding new behavior to a router skill — 'X is a command/subcommand that calls an agent', or wiring an agent-spawn into the flow">
Default to a SUBCOMMAND (table row + `references/<sub>.md`), NOT a standalone `commands/<name>.md`. Router capabilities live as subcommands; a subcommand's reference may spawn a dedicated agent. Don't create a parallel command file unless the user explicitly says "command". When they say "subcommand" (or correct you to it), the deliverable is the router row + reference only.
</task-relevant>

<task-relevant when="applying a fix across a category of files (e.g. all *-help commands, all configs of a kind)">
Glob the full set first, then apply to every member — don't fix only the ones already in your context. Missing one member is the common failure. Verify with a find/grep that no member was skipped.
</task-relevant>

<task-relevant when="a client/server flow fails and you're inferring which side is at fault">
Probe the live endpoint to localize the fault before reading source or editing. For gRPC: `grpcurl -plaintext -import-path <root> -proto <file> -d '{}' localhost:<port> <Service/Method>` (build an include-root with symlinks if reflection is auth-gated). The server response settles client-vs-server immediately.
</task-relevant>

<task-relevant when="desktop SSO/runtime behaves inconsistently with the committed source">
Suspect stale BUILD ARTIFACTS git doesn't track, not the source: the Go binary `cmd/platforma/platforma` and the pl-client `package.tgz` (desktop `pnpm.overrides` `file:…`). Reverting source does NOT rebuild them. Rebuild before trusting runtime (`go build -o cmd/platforma/platforma ./cmd/platforma`; pl-client `pnpm run build && pnpm run do-pack`; desktop `pnpm install --no-frozen-lockfile`).
</task-relevant>

<task-relevant when="edited a Go CLI tool under dotfiles scripts/ and the user says changes don't show / asks to rebuild">
A local `go build` does NOT deploy. The tool runs from PATH (e.g. `~/.local/share/mise/installs/go/*/bin/<name>`), and its zshrc alias is install-if-missing (`command -v <name> >/dev/null || go install .`), so it never reinstalls once present. Run `go install .` from the tool dir to replace the PATH binary.
</task-relevant>

<task-relevant when="refreshing platforma-desktop-app deps after rebuilding a platforma tgz (pl-client etc.)">
To pick up rebuilt `file:../platforma/lib/**/package.tgz` overrides, run `pnpm install --lockfile-only --no-frozen-lockfile` (no package name arg — a bare `pnpm install <pkg>` triggers `ERR_PNPM_ADDING_TO_ROOT`). It refreshes the content-hash lock entries WITHOUT running the `postinstall` electron step. A plain `pnpm install` runs postinstall, which crashes with "Electron failed to install correctly" when `node_modules/.pnpm/electron@*/node_modules/electron/path.txt` is missing (dist present, path.txt gone). Fix that separately: `node <that electron dir>/install.js` regenerates path.txt. tgz keyed by content hash, not version — no `package.json` version string changes.
</task-relevant>

<task-relevant when="running go build / pnpm build/pack/install under /Users/vitaliipopov/git/mil/…">
That path is NOT in the sandbox write allowlist — writes fail with "Operation not permitted (os error 1)". Run with `dangerouslyDisableSandbox: true`.
</task-relevant>

<task-relevant when="authoring a command/subcommand that creates a git fixup commit (git commit --fixup)">
Create the fixup commit only — never chain `git rebase --autosquash`. Collapsing fixups into their targets is a separate deliberate step the user triggers (`/code squash`); auto-squashing rewrites history behind their back. Keep the responsibilities split: `fix` makes the fixup, `squash` collapses it.
</task-relevant>

<task-relevant when="a gh API command fails to resolve a milaboratory/ org repo, or git push to a popoffvg/ repo is denied">
Two accounts: `popoffvg` (personal — SSH push works; force key with `git config core.sshCommand "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"` since default key selection can auth as the wrong user) and `vgpopov` (work — resolves milaboratory/ org repos). For gh API on org repos: `gh auth switch --user vgpopov`, run the op, then `gh auth switch --user popoffvg` to restore.
</task-relevant>

<task-relevant when="a git fetch / gh pr checkout / clone on a milaboratory org repo fails with 'Repository not found' over an SSH (git@github.com:) remote">
The SSH key always auths as `popoffvg` (personal), which can't read milaboratory/ org repos — independent of the active gh account. `gh auth switch` does NOT help; it only affects gh's HTTPS API token, not the SSH transport git uses for the remote's `git@github.com:` URL. Fix: rewrite SSH→HTTPS for that one command so it uses gh's `vgpopov` token — `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com: gh pr checkout <url>`. Scoped, no persistent config change.
</task-relevant>
