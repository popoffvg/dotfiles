# Harness deployment with Rulesync

Run `mise run harness:sync` from the dotfiles checkout. It pins Rulesync from
`package-lock.json` into the user's cache, imports native source definitions, and
generates installed copies outside the repository. Node 22.22 or newer is required.

## Edit and deploy

Edit plugins in `harness/plugins/`, loose skills in `harness/skills/`, personal Claude
definitions and helper files in `harness/claude/`, Pi settings in `harness/pi/`, and
shared maintenance behavior here.
The sources intentionally retain native Claude frontmatter. Rulesync imports them
into disposable source trees on each deployment, then generates target components.
The import adds implicit agent names in staging; it never rewrites source metadata.

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
| Claude | `/wm`, `/code`, `/review`, `/dive` in `~/.claude/commands/` | Native skills with `user-invocable: false`, plus `~/.claude/harness/plugins/` |
| Codex | `$wm`, `$code`, `$review`, `$dive` in `~/.codex/skills/` | `~/.codex/harness/skills/` and `harness/plugins/`; selected through `AGENTS.md` and `harness/skill-index.md` |
| Pi | `/wm`, `/code`, `/review`, `/dive` in `~/.pi/agent/prompts/` | `~/.pi/agent/harness/skills/` and `harness/plugins/`; selected through `AGENTS.md` and `harness/skill-index.md` |

Codex and Pi do not provide Claude's separate hidden/model-only switch. Their
workers are reference files outside native skill discovery. The instruction marker
requires reading the index and loading relevant workers. This changes discovery:
worker descriptions are read through the index rather than injected natively.
ADR remains automatic and has no public alias. Existing manual-only workers stay
explicit in the index; a requested route can load them. Public aliases are explicit.

After native import, `invocation.mjs` promotes source `disable-model-invocation`
to Rulesync's shared field. Rulesync emits Codex's `policy.allow_implicit_invocation`
and Pi's supported flag; target-specific `agents/openai.yaml` settings are preserved.
All owned Claude worker outputs receive `user-invocable: false`. The native Codex WM
registration is retired during sync because Codex discovers a plugin's default
`skills/` even with an empty manifest list. The library remains installed privately.
Pi's Claude marketplace bridge does not re-export the
owned plugins already deployed privately by Rulesync.

Only the maintenance guard is added to Codex and Pi. Existing Claude plugin hooks
stay with Claude; WM's Codex runtime documents explicit lifecycle checks. Importing
an event does not translate its payload or make its script portable. The Pi guard
uses its native `tool_call` payload, which Rulesync's command-hook adapter does not
pass to the command. Guards cover direct edit/write/patch tools; they are workflow
checks, not an operating-system sandbox for arbitrary shell code.

Line-comment uses `$line-comment-<operation>` in Codex and
`/line-comment-<operation>` in Claude and Pi. These aliases read the original
command procedures; they do not migrate Claude hooks or run the commands during sync.

## Ownership and verification

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

## Internal Claude workflows

The former project `.claude/workflows/wm-code-auto.js` and `wm-code-impl.js`
sources live in `harness/rulesync/workflows/`. Sync installs executable copies in
`~/.claude/harness/workflows/`, outside native command discovery. The WM aliases
and instruction marker link their route and `Workflow.scriptPath` usage guide.
Auto bundles the implementation body as a local async function, preserving its
arguments without resolving the former saved workflow name. Generated prompts
resolve the WM plugin root to the installed private library.
