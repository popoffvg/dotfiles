# Mission: the block workflow engine

> A filled `<notes-dir>/teach/MISSION.md`. Copy the file, replace the content, delete the `>`
> lines — each one states the rules for the piece above it.
> The mission is the compass: what to teach next, which files to surface, which exercise to design,
> all trace back to it. Keep it under one screen; past that it has stopped being a compass and
> started being a plan. One mission per workspace — two unrelated subsystems are two workspaces.

## Why

Ivan reviews workflow pull requests today by trusting the author, because he cannot tell a wrong Tengo template from a right one. He wants to review them unaided before the October release, and later own the engine when its current maintainer moves teams.

> Mission-first rules: `teach:commands/sub-teach.md` § The mission comes first.

## Success looks like

- Reads a workflow template diff and names which result-pool entries it changes, without running it
- Adds a new step to an existing workflow and predicts what the test asserts before running it
- Explains to a teammate why the engine re-renders a template on every input change

> Each success criterion is an observable act in this repository.

## Constraints

- 45 minutes per session, twice a week
- Reads Go fluently, has never written Tengo
- Will not read the generated protobuf bindings

> Record time, background, known languages, and material the human refuses to read.

## Out of scope

- The desktop UI that renders workflow results
- The storage layer under the result pool

> List adjacent subsystems excluded now. Update a shifted mission with a learning record; see
> `teach:commands/sub-teach.md` § The mission comes first.
