# Harness deployment with Rulesync

Run `mise run harness:sync` from the dotfiles checkout. It pins Rulesync from
`package-lock.json` into the user's cache, imports native source definitions, and
generates installed copies outside the repository. Node 22.22 or newer is required.

## Edit and deploy

Edit plugins in `harness/plugins/`, loose skills in `harness/skills/<group>/<name>/`, personal Claude
definitions and helper files in `harness/claude/`, Pi settings in `harness/pi/`, and
shared maintenance behavior here.
The sources intentionally retain native Claude frontmatter. Rulesync imports them
into disposable source trees on each deployment, then generates target components.
The import adds implicit agent names in staging; it never rewrites source metadata.

## Effort selection

Shared instructions select `{light}`, `{medium}`, or `{heavy}` effort. [`effort-ledger.json`](effort-ledger.json) maps each symbol to both a model and a reasoning setting for each harness. Change the mapping there, not in skills.

Source agents declare a symbol such as `harness-effort: "{medium}"`; optional `harness-variants` lists additional tier variants. Deployment compiles native settings without changing the agent's role. Generic `effort-light`, `effort-medium`, and `effort-heavy` agents serve unnamed work. CLI helpers use [`effort.py`](effort.py) to apply the same mapping.

Escalate deficient reasoning from light to medium, then to heavy. Authentication, quota, and transport failures remain blockers. Explicit user overrides win. Keep requested settings distinct from model metadata.

OpenCode and Codex model/effort pairs match their local catalogs. Cursor and Pi profiles use the installed Cursor SDK catalog. Live Cursor availability requires `agent login`; generation and mocked tests do not prove provider access.

## Public aliases and internal workers

`config.json` exposes `wm`, `code`, `review`, `dive`, and the five
`line-comment-*` aliases: `act`, `write`, `unresolved`, `prune`, and `distill`.
Selected personal aliases also expose their existing internal skills;
`publicAliases` in `config.json` is the full list.
All public aliases require explicit invocation. Line-comment aliases load the
installed plugin commands with their sibling references and scripts intact.
Alias templates live in `commands/`. Other installed plugins and built-in commands
keep their own menus. Source plugin commands remain authoring references and are
installed under `internal-commands/`; commands nested within skills retain their paths.

| Runtime | Public entry points | Internal workers |
|---|---|---|
| Claude | `/wm`, `/code`, `/review`, `/dive` in `~/.claude/commands/`; public loose skills in `~/.claude/skills/` | Native skills with `user-invocable: false`, plus `~/.claude/harness/plugins/` |
| Codex | `$wm`, `$code`, `$review`, `$dive` in `~/.codex/skills/` | `~/.codex/harness/skills/` and `harness/plugins/`; selected through `AGENTS.md` and `harness/skill-index.md` |
| Pi | `/wm`, `/code`, `/review`, `/dive` in `~/.pi/agent/prompts/` | `~/.pi/agent/harness/skills/` and `harness/plugins/`; selected through `AGENTS.md` and `harness/skill-index.md` |
| OpenCode | `/wm`, `/code`, `/review`, `/dive` in `~/.config/opencode/commands/` | `~/.config/opencode/harness/skills/` and `harness/plugins/`; selected through `AGENTS.md` and `harness/skill-index.md` |

Codex and Pi do not provide Claude's separate hidden/model-only switch. Their
workers are reference files outside native skill discovery. The instruction marker
requires reading the index and loading relevant workers. This changes discovery:
worker descriptions are read through the index rather than injected natively.
ADR remains automatic and has no public alias. Existing manual-only workers stay
explicit in the index; a requested route can load them. Public aliases are explicit.

After native import, `invocation.mjs` promotes source `disable-model-invocation`
to Rulesync's shared field. Rulesync emits Codex's `policy.allow_implicit_invocation`
and Pi's supported flag; target-specific `agents/openai.yaml` settings are preserved.
A loose skill named in `publicAliases` is the Claude entry point itself: it gets `user-invocable: true`, and no Claude command is written for it. Every other owned Claude skill gets `user-invocable: false`. The native Codex WM
registration is retired during sync because Codex discovers a plugin's default
`skills/` even with an empty manifest list. The library remains installed privately.
Pi's Claude marketplace bridge does not re-export the
owned plugins already deployed privately by Rulesync.

Claude retains its native WM hooks. Codex, Pi, OpenCode, and Cursor use native adapters backed by [wm_hooks.py](wm_hooks.py). The adapters read the [WM hook manifest](../plugins/wm/hooks/hooks.json), normalize tool inputs, and translate context and block decisions. Patch calls check every affected file before execution. Hook failures block pre-tool checks. Other hook failures remain visible.

Codex hooks require review and trust through `/hooks`. Pi uses an extension. OpenCode uses its native server plugin. Cursor uses user-level command hooks. Cursor cannot inject prompt or compaction hook output as model context; its session hook supplies the initial context. OpenCode maps successful execution completion to Stop and archive or deletion to SessionEnd. Neither mapping is an operating-system sandbox.

`AGENTS.md` is canonical in the source harness. Deployment generates Claude compatibility imports. `/code new` creates the project workflow entry and notes guides through [wm-agents.py](../plugins/wm/bin/wm-agents.py). Existing instructions remain intact.

Line-comment uses `$line-comment-<operation>` in Codex and
`/line-comment-<operation>` in Claude and Pi. These aliases read the original
command procedures; they do not migrate Claude hooks or run the commands during sync.

## Ownership and verification

Run `mise run harness:codex:rtk` to deploy the Codex RTK hook and enable SQLite recall in the RTK user configuration. Use RTK 1.2.0 or later. Restart Codex and trust `rtk hook codex` in `/hooks`. [RTK hook](https://github.com/rtk-ai/rtk/blob/v1.2.0/hooks/codex/README.md) · [Codex hook trust](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)

If Codex cannot write the SQLite databases, add the RTK data directory to the existing workspace-write roots in your local Codex settings. [RTK sandbox configuration](https://github.com/rtk-ai/rtk/blob/v1.2.0/hooks/codex/README.md#history-in-workspace-write-sandboxes)

`harness/installed.json` under each runtime maps installed files to repository
sources and hashes. Deployment replaces known Stow links by replacing the link
itself, not writing through it. It refuses unmanaged collisions or edited owned
files, and retracts only unchanged files it previously installed. Third-party
skills and Codex configuration remain owned by their installers. Shared Codex
hooks are merged with existing registrations.

Run `python3 harness/rulesync/deploy.py --check` to compare installed output with
fresh generation. Run `mise run harness:test` for ownership and guard tests.
For an isolated full deployment, pass `--home /absolute/scratch/home`, followed by
the same command with `--check`. Runtime output inside the checkout is rejected.

If deployment reports a collision, preserve the file and reconcile it with its
source before retrying. Do not use deletion sweeps over user skill directories.
Reload or restart the runtime after deployment; refresh Claude's local marketplace
when plugin versions change. The git source is the recovery copy: rerun deployment
from the desired revision after inspecting any installed edits.

## OpenCode

Install OpenCode v2 with `npm install -g @opencode/cli`. Connect OpenAI with `opencode auth login openai`. The managed configuration selects `openai/gpt-6.1-sol` with medium reasoning effort. [OpenCode installation](https://opencode.ai/docs/), [provider authentication](https://opencode.ai/docs/providers/), [model settings](https://opencode.ai/docs/models/).

Edit runtime settings and native plugins in `harness/opencode/`. Sync merges managed JSON settings into the existing global configuration. Other providers and unrelated settings remain in that configuration. Credentials remain in OpenCode's credential storage.

Rulesync generates OpenCode skills and agents from the shared sources. Public aliases become native commands. Internal workers remain outside native discovery, as in Codex. OpenCode subagents inherit the selected model. The native source guard checks edit and shell calls against the ownership manifests. [Runtime adapter](../opencode/harness/runtime.md), [guard adapter](../opencode/plugins/harness-source-guard/index.ts).

Codex sessions and connected ChatGPT plugins remain in Codex. The migration does not convert conversation history or plugin connections. Claude lifecycle hooks require explicit checks from the runtime adapter.

## Internal Claude workflows

The former project `.claude/workflows/wm-code-auto.js` and `wm-code-impl.js`
sources live in `harness/rulesync/workflows/`. Sync installs executable copies in
`~/.claude/harness/workflows/`, outside native command discovery. The WM aliases
and instruction marker link their route and `Workflow.scriptPath` usage guide.
Auto bundles the implementation body as a local async function, preserving its
arguments without resolving the former saved workflow name. Generated prompts
resolve the WM plugin root to the installed private library.
