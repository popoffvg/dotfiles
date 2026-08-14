# Mission: the block workflow engine

> This file is a filled `MISSION.md`. Copy it to `<notes-dir>/teach/MISSION.md`, replace the
> content, and delete every `>` line — each one states the rule for the block above it.
> The mission is the compass: what to teach next, which files to surface, which exercise to design,
> all trace back to it. Keep it under one screen; past that it has stopped being a compass and
> started being a plan. One mission per workspace — two unrelated subsystems are two workspaces.

## Why

Ivan reviews workflow pull requests today by trusting the author, because he cannot tell a wrong Tengo template from a right one. He wants to review them unaided before the October release, and later own the engine when its current maintainer moves teams.

> 1–3 sentences naming the concrete goal at work: what the human does differently once they hold
> this code in their head. Push past "to understand X" to the outcome underneath — review it,
> extend it, own it, hand it over.
> A human who cannot say why is interviewed before anything is written. A bad mission is worse than
> no mission, because it steers every lesson wrong.

## Success looks like

- Reads a workflow template diff and names which result-pool entries it changes, without running it
- Adds a new step to an existing workflow and predicts what the test asserts before running it
- Explains to a teammate why the engine re-renders a template on every input change

> Each line is something the human does in this repo that another person can check. Name the
> observable act, never the feeling — "reviews the scheduler PRs unaided" beats "understands the
> scheduler", and "confident with the block model" is not success at all.

## Constraints

- 45 minutes per session, twice a week
- Reads Go fluently, has never written Tengo
- Will not read the generated protobuf bindings

> Time per session, prior background, languages already known, what they refuse to read.

## Out of scope

- The desktop UI that renders workflow results
- The storage layer under the result pool

> Adjacent subsystems the human does not want to chase now. This list protects the level: without
> it every lesson widens until it teaches the whole repo.

> **Revise when reality shifts.** A mission moves. Update this file and write a learning record;
> never leave a stale mission steering later sessions.
