[Skip to content](https://github.com/alexpasmantier/television/tree/main/docs/developers#start-of-content)

You signed in with another tab or window. [Reload](https://github.com/alexpasmantier/television/tree/main/docs/developers) to refresh your session.You signed out in another tab or window. [Reload](https://github.com/alexpasmantier/television/tree/main/docs/developers) to refresh your session.You switched accounts on another tab or window. [Reload](https://github.com/alexpasmantier/television/tree/main/docs/developers) to refresh your session.Dismiss alert

{{ message }}

[alexpasmantier](https://github.com/alexpasmantier)/ **[television](https://github.com/alexpasmantier/television)** Public

- [Sponsor](https://github.com/sponsors/alexpasmantier)
- [Notifications](https://github.com/login?return_to=%2Falexpasmantier%2Ftelevision) You must be signed in to change notification settings
- [Fork\\
169](https://github.com/login?return_to=%2Falexpasmantier%2Ftelevision)
- [Star\\
5.8k](https://github.com/login?return_to=%2Falexpasmantier%2Ftelevision)


## Collapse file tree

## Files

main

Search this repository(forward slash)` forward slash/`

/

# developers

/

Copy path

## Directory actions

## More options

More options

## Directory actions

## More options

More options

## Latest commit

![github-actions[bot]](https://avatars.githubusercontent.com/in/15368?v=4&size=40)![alexpasmantier](https://avatars.githubusercontent.com/u/47638216?v=4&size=40)

[github-actions\[bot\]](https://github.com/alexpasmantier/television/commits?author=github-actions%5Bbot%5D)

and

[alexpasmantier](https://github.com/alexpasmantier/television/commits?author=alexpasmantier)

[chore(changelog): update changelog (auto) (](https://github.com/alexpasmantier/television/commit/bcc2e35236f54cff27ec90dbfba1d3c3204077f1) [#1041](https://github.com/alexpasmantier/television/pull/1041) [)](https://github.com/alexpasmantier/television/commit/bcc2e35236f54cff27ec90dbfba1d3c3204077f1)

Open commit detailsfailure

last monthApr 14, 2026

[bcc2e35](https://github.com/alexpasmantier/television/commit/bcc2e35236f54cff27ec90dbfba1d3c3204077f1) · last monthApr 14, 2026

## History

[History](https://github.com/alexpasmantier/television/commits/main/docs/developers)

Open commit details

[View commit history for this file.](https://github.com/alexpasmantier/television/commits/main/docs/developers) History

/

# developers

/

Top

## Folders and files

| Name | Name | Last commit message | Last commit date |
| --- | --- | --- | --- |
| ### parent directory<br> [..](https://github.com/alexpasmantier/television/tree/main/docs) |
| [release-notes](https://github.com/alexpasmantier/television/tree/main/docs/developers/release-notes "release-notes") | [release-notes](https://github.com/alexpasmantier/television/tree/main/docs/developers/release-notes "release-notes") | [perf: undo](https://github.com/alexpasmantier/television/commit/30c4951b503001e8c96c7b205de5960179093ca3 "perf: undo 5eaa2c3 and 5019651 that regressed ingestion throughput  The mem::replace pattern in load_candidates allocates a fresh 256-byte Vec per line instead of reusing the grown buffer, causing ~2.4x throughput regression on plain text (444 -> 183 MB/s at 2.6M lines). The utf32_to_string change compounds it further.") [`5eaa2c3`](https://github.com/alexpasmantier/television/commit/5eaa2c3bb6a675f4323de04fdd883fba27aede9a) [and](https://github.com/alexpasmantier/television/commit/30c4951b503001e8c96c7b205de5960179093ca3 "perf: undo 5eaa2c3 and 5019651 that regressed ingestion throughput  The mem::replace pattern in load_candidates allocates a fresh 256-byte Vec per line instead of reusing the grown buffer, causing ~2.4x throughput regression on plain text (444 -> 183 MB/s at 2.6M lines). The utf32_to_string change compounds it further.") [`5019651`](https://github.com/alexpasmantier/television/commit/50196511002861b3e509d6d641a4404f3bbbd6f2) [that regressed ingestion throughput](https://github.com/alexpasmantier/television/commit/30c4951b503001e8c96c7b205de5960179093ca3 "perf: undo 5eaa2c3 and 5019651 that regressed ingestion throughput  The mem::replace pattern in load_candidates allocates a fresh 256-byte Vec per line instead of reusing the grown buffer, causing ~2.4x throughput regression on plain text (444 -> 183 MB/s at 2.6M lines). The utf32_to_string change compounds it further.") | last monthApr 14, 2026 |
| [\_category\_.json](https://github.com/alexpasmantier/television/blob/main/docs/developers/_category_.json "_category_.json") | [\_category\_.json](https://github.com/alexpasmantier/television/blob/main/docs/developers/_category_.json "_category_.json") | [docs: documentation overhaul (](https://github.com/alexpasmantier/television/commit/dcc536a1d70ba432b456582bf2404da0f0c58cd6 "docs: documentation overhaul (#886)") [#886](https://github.com/alexpasmantier/television/pull/886) [)](https://github.com/alexpasmantier/television/commit/dcc536a1d70ba432b456582bf2404da0f0c58cd6 "docs: documentation overhaul (#886)") | last monthApr 14, 2026 |
| [contributing.md](https://github.com/alexpasmantier/television/blob/main/docs/developers/contributing.md "contributing.md") | [contributing.md](https://github.com/alexpasmantier/television/blob/main/docs/developers/contributing.md "contributing.md") | [docs: fix incorrect Windows paths in documentation (](https://github.com/alexpasmantier/television/commit/d070d0614c1ea8184f6cd5f5ea211e486ad135a0 "docs: fix incorrect Windows paths in documentation (#974)  ## Summary  The documented Windows paths for config, cable, and log files are missing subdirectories that the `directories` crate adds on Windows.  For example, the config file path is documented as `%LocalAppData%\television\config.toml` but the actual path is `%LocalAppData%\television\config\config.toml`. Similarly, log files are under a `data\` subdirectory.  Fixed paths across all affected docs: - Config: `%LocalAppData%\television\config\config.toml` - Cable: `%LocalAppData%\television\config\cable\` - Logs: `%LocalAppData%\television\data\television.log`  ## Test plan  - Verified the actual paths on a Windows 11 machine by checking the directory structure created by `tv` after a fresh `winget` install") [#974](https://github.com/alexpasmantier/television/pull/974) [)](https://github.com/alexpasmantier/television/commit/d070d0614c1ea8184f6cd5f5ea211e486ad135a0 "docs: fix incorrect Windows paths in documentation (#974)  ## Summary  The documented Windows paths for config, cable, and log files are missing subdirectories that the `directories` crate adds on Windows.  For example, the config file path is documented as `%LocalAppData%\television\config.toml` but the actual path is `%LocalAppData%\television\config\config.toml`. Similarly, log files are under a `data\` subdirectory.  Fixed paths across all affected docs: - Config: `%LocalAppData%\television\config\config.toml` - Cable: `%LocalAppData%\television\config\cable\` - Logs: `%LocalAppData%\television\data\television.log`  ## Test plan  - Verified the actual paths on a Windows 11 machine by checking the directory structure created by `tv` after a fresh `winget` install") | last monthApr 14, 2026 |
| [patch-notes.md](https://github.com/alexpasmantier/television/blob/main/docs/developers/patch-notes.md "patch-notes.md") | [patch-notes.md](https://github.com/alexpasmantier/television/blob/main/docs/developers/patch-notes.md "patch-notes.md") | [chore(changelog): update changelog (auto) (](https://github.com/alexpasmantier/television/commit/bcc2e35236f54cff27ec90dbfba1d3c3204077f1 "chore(changelog): update changelog (auto) (#1041)  This PR was created by a GitHub Action to update the changelog.  Co-authored-by: alexpasmantier <47638216+alexpasmantier@users.noreply.github.com>") [#1041](https://github.com/alexpasmantier/television/pull/1041) [)](https://github.com/alexpasmantier/television/commit/bcc2e35236f54cff27ec90dbfba1d3c3204077f1 "chore(changelog): update changelog (auto) (#1041)  This PR was created by a GitHub Action to update the changelog.  Co-authored-by: alexpasmantier <47638216+alexpasmantier@users.noreply.github.com>") | last monthApr 14, 2026 |
| [shell-integration-local.md](https://github.com/alexpasmantier/television/blob/main/docs/developers/shell-integration-local.md "shell-integration-local.md") | [shell-integration-local.md](https://github.com/alexpasmantier/television/blob/main/docs/developers/shell-integration-local.md "shell-integration-local.md") | [docs: documentation overhaul (](https://github.com/alexpasmantier/television/commit/dcc536a1d70ba432b456582bf2404da0f0c58cd6 "docs: documentation overhaul (#886)") [#886](https://github.com/alexpasmantier/television/pull/886) [)](https://github.com/alexpasmantier/television/commit/dcc536a1d70ba432b456582bf2404da0f0c58cd6 "docs: documentation overhaul (#886)") | last monthApr 14, 2026 |
| View all files |

You can’t perform that action at this time.