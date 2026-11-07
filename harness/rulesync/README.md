# Harness deployment with Rulesync

Run `mise run harness:sync` from the dotfiles checkout. It pins Rulesync from
`package-lock.json` into the user's cache, imports native source definitions, and
generates installed copies outside the repository. Node 22.22 or newer is required.

## Edit and deploy

Edit plugins in `harness/plugins/`, personal Claude definitions and helper files in
`harness/claude/`, Pi settings in `harness/pi/`, and shared maintenance behavior here.
The sources intentionally retain native Claude frontmatter. Rulesync imports them
into disposable source trees on each deployment, then generates target components.
The import adds implicit agent names in staging; it never rewrites source metadata.

| Runtime | Installed files |
|---|---|
| Claude | `~/.claude/skills/`, `~/.claude/harness/plugins/`, local marketplace under `~/.claude/harness/` |
| Codex | `~/.codex/skills/`, `~/.codex/harness/plugins/`, maintenance hook in `~/.codex/hooks.json` |
| Pi | `~/.pi/agent/skills/`, `~/.pi/agent/harness/plugins/`, maintenance extension in `~/.pi/agent/extensions/` |

Plugin skill links for Codex and Pi point at the installed plugin's own skill
directory, preserving references to sibling skills and root assets. Links point
inside the home installation, never back into source. Codex namespaces plugin
skills itself; WM's entry point comes from its installed native Codex plugin.
Pi receives `<plugin>-<skill>` names, such as `wm-code`, for plugin skills.

Only the maintenance guard is added to Codex and Pi. Existing Claude plugin hooks
stay with Claude; WM's Codex runtime documents explicit lifecycle checks. Importing
an event does not translate its payload or make its script portable. The Pi guard
uses its native `tool_call` payload, which Rulesync's command-hook adapter does not
pass to the command. Guards cover direct edit/write/patch tools; they are workflow
checks, not an operating-system sandbox for arbitrary shell code.

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
