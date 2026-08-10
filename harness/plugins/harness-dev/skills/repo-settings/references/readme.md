# Base README.md

The README answers one question: **a new engineer opened this repo — what is it, how do they run it, and where do they go next?** Everything that does not serve that question belongs in `docs/`.

## Required sections, in order

1. **Title and one-sentence purpose.** What the repo produces and for whom. No history, no roadmap.
2. **Status badges**, only if CI exists. Build and coverage. Two at most.
3. **Quick start.** The shortest path from a fresh clone to a running thing. Prerequisites, install, run — three blocks at most. Every command copy-pasteable and verified against a real file.
4. **Layout.** A table of the top-level directories a reader will open, one line each. Skip directories a reader never opens.
5. **Common commands.** Build, test, lint, format — as a table of `command` → what it does. Taken from the `Makefile`, `mise.toml`, or `package.json`, never invented.
6. **Deploy.** Two or three sentences: the target, the trigger, the artifact. Then a pointer to `.claude/skills/deploy/SKILL.md` for the full procedure. The README states *that* deploy happens; the deploy skill states *how*.
7. **Decisions.** One line pointing at `docs/adr/`, present only once the first ADR exists.
8. **Further reading.** Links to `docs/`, the runbook, the dashboard. Relative paths for in-repo files.

## Rules

- **Every command in the README runs.** A command not read from a real file in the survey step does not go in.
- **Link, do not restate.** A fact stated in the deploy skill, an ADR, or a `docs/` page appears in the README as a pointer. Two copies drift apart.
- **Keep prose short.** One paragraph per section. A reader scans a README; long prose gets skipped whole.
- **In-repo links are relative.** `docs/adr/` and `.claude/skills/deploy/SKILL.md` resolve in the GitHub UI and in an editor.

## Sections to leave out

Contribution guidelines, changelog, licence text, architecture essays, API reference. Each gets its own file, linked from *Further reading*. A README that grows past two screens has stopped answering its one question.
