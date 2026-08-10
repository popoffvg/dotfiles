# template — teach MISSION.md

`MISSION.md` sits at `<notes-dir>/teach/MISSION.md`. It captures the reason the human is learning
this codebase. Every teaching decision — what to teach next, which files to surface, which exercise
to design — traces back to it. Used by `sub-teach.md`.

## Template

```md
# Mission: {the subsystem, package, or change}

## Why
{1-3 sentences. The concrete goal at work. What does the human do differently once they hold this
code in their head? Push past "to understand X" to the underlying outcome — review it, extend it,
own it, hand it over.}

## Success looks like
- {A specific, observable thing the human will be able to do in this repo}
- {Another specific thing}
- {…}

## Constraints
- {Time per session, prior background, languages already known, what they refuse to read}

## Out of scope
- {Adjacent subsystems the human does not want to chase now — this protects the level}
```

## Rules

- **One mission per workspace.** Two unrelated subsystems are two workspaces.
- **Concrete over abstract.** "Review the scheduler PRs unaided by October" beats "understand the
  scheduler." "Add a new block type without help" beats "learn the block model."
- **Push back on vagueness.** The human who cannot say why is interviewed before anything is
  written. A bad mission is worse than no mission — it steers every lesson wrong.
- **Name the observable act, not the feeling.** Success is something the human does in the repo and
  someone else can check, not a sense of confidence.
- **Revise when reality shifts.** Missions move. Update the file and write a learning record; never
  leave a stale mission steering future sessions.
- **Keep it under a screen.** Past that it has stopped being a compass and started being a plan.
