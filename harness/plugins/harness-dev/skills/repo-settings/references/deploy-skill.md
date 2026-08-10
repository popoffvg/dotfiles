# The per-repo deploy skill

Write `.claude/skills/deploy/SKILL.md` — a **workflow** skill holding this repo's deploy procedure. It is user-invocable only: deploying is side-effecting, so Claude never decides when it runs.

## Frontmatter

```yaml
---
name: deploy
description: Deploy <repo> to <environments>. Use for "deploy", "ship this", "release to staging", "promote to prod", "roll back <repo>".
disable-model-invocation: true
---
```

## Body

Ordered steps, each ending on a checkable condition. Derive every step from a file read in the survey — a CI workflow, a release script, a Helm chart. Mark anything the user supplied verbally as such, so a later reader knows it is unverified.

1. **Preflight.** The state that must hold before deploying: branch, clean tree, green CI, migration status. Each as a command whose output the agent checks.
2. **Build the artifact.** The exact command and where the artifact lands — image tag, package version, bundle path.
3. **Deploy to each environment, in promotion order.** One step per environment. Each names its command, its approval gate, and its smoke check.
4. **Verify.** The command or URL that proves the new version serves traffic. Include the expected output.
5. **Roll back.** The command that returns the previous version, and the signal that calls for it.

## Rules

- **Read-only and applying commands stay separate.** `plan`, `diff`, and `status` run freely; `apply`, `push`, and `promote` are their own steps, so an approval gate has somewhere to sit.
- **State the environments in promotion order.** dev → staging → prod. Skipping an environment is a decision the step must name, not a silent option.
- **Secrets are named, never inlined.** State which store holds the credential and which variable carries it.
- **Every command is copy-pasteable.** A placeholder like `<version>` appears with the command that produces it.

## Keeping it current

The deploy skill is generated from the CI workflows and release scripts. When those change, the skill is stale until it is regenerated. `CLAUDE.md` carries that rule — see `references/claude-md.md`.
