# A synced marketplace entry is not an installed plugin

Three separate things must be true before a plugin's `/command` exists. Writing the source does one.

| Step | How | Check |
|---|---|---|
| 1. Listed in a marketplace | regenerate `marketplace.json` from the plugin sources | the entry names the plugin dir |
| 2. Installed | `claude plugin install <name>@<marketplace>` | `~/.claude/plugins/cache/<marketplace>/<name>/<version>/` exists |
| 3. Enabled | `"<name>@<marketplace>": true` in `enabledPlugins` in `settings.json` | the key is present |

Then verify with the command that reads all three:

```sh
claude plugin details <name>@<marketplace>
```

It must print the plugin, its version, and the component under `Component inventory` — `Skills (1) <name>`, an agent, a command. An empty inventory means the file is in the wrong place inside the plugin.

## Changing an installed plugin needs `update`, not `install`

`claude plugin install` on an already-installed plugin prints `already installed` and copies nothing,
so a plugin you just edited keeps serving its old cached version. After bumping the version, run:

```sh
claude plugin update <name>@<marketplace>
```

`claude plugin details` is not sufficient on its own here — it reads the marketplace source, so it
reports the new version and the new components while the cache still holds the old ones. Confirm the
cache itself:

```sh
find ~/.claude/plugins/cache/<marketplace>/<name> -name SKILL.md
```

The new version directory must be there with every component in it.

## Then say a restart is needed

Skills, commands, agents, and hooks load when a session starts. The session that created the plugin never sees it, however correct the install is. Tell the user to open a new session, and give them the exact invocation to try, pointed at a fixture or sample file rather than their real work.

## What this prevents

Reporting a feature as "installed and verified" when the user's next keystroke finds no such command. Passing tests on the underlying tool prove the tool, not the plugin wiring — those are separate claims and only the `plugin details` output supports the second one.
