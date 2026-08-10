---
name: test-github-actions
description: Run and debug GitHub Actions locally before pushing — with `act` (CLI) or `@kie/act-js` (programmatic API), including job filtering, event payload simulation, secret/env injection, mocking, and pl-repo constraints.
---

# Test GitHub Actions locally

**Pick the tool by the test's shape.** `act` (CLI) for one-off validation of workflow logic; `@kie/act-js` for repeatable tests in JS/TS with step/API mocking. Both need Docker running.

## Workflow

1. Identify the target workflow and event.
2. List jobs first (`act --list` / `act.list(event)`), then run **one job** (`-j <job>` / `runJob`).
3. Inject only the secrets and env the job needs; never commit secret files.
4. Use an explicit event payload (`--eventpath file.json` / `setEvent({...})`) when logic reads `github.event.*`.
5. Expand to the full event run only after the targeted pass.

```bash
act pull_request -j lint --eventpath .github/events/pr.json -s GITHUB_TOKEN=xxx
```

```ts
import { Act } from "@kie/act-js";
const out = await new Act(process.cwd(), ".github/workflows")
  .setSecret("GITHUB_TOKEN", "test-token")
  .setInput("deploy-staging", "false")
  .setEvent({ pull_request: { head: { ref: "feature/test" } } })
  .runJob("lint", { logFile: ".tmp/act-lint.log" });
```

For flaky externals, act-js mocks HTTP APIs (`Mockapi` + `mockApi` option) and individual steps (`mockSteps`, matched by `id`/`name`/`uses`/`run`/index). Full examples live in the act-js repo tests (`test/it/act.test.ts`) — read them there instead of copying.

## pl repo profile

Applies when testing `mil/pl` workflows:

- Start with low-coupling jobs (`lint`, `actionlint`) — full `trigger-commit-pr.yaml` depends on private actions, cloud auth, and self-hosted runners.
- Self-hosted runner labels (`dev-ci-pl`, `rockylinux8-amd64`) will not match locally: validate logic/syntax locally, mark environment-specific behavior CI-only.
- Private actions (`milaboratory/github-ci/*`, `github-ci-internal/*`) may fail to pull without org access — test wiring with jobs that avoid them.
- Reusable workflows compose via `workflow_call` + `secrets: inherit`: validate the callee standalone, then the caller's `needs`/conditions/dispatch inputs.
- `workflow_dispatch` paths: dispatch with `deploy-staging=false` first.
- Test at least the PR payload path, push-to-main path, and workflow_dispatch path — concurrency groups and conditions differ per event.
- Common secrets to stub: `MI_LICENSE`, `GH_CI_PAT`, `AWS_CI_TURBOREPO_S3_BUCKET`, `NPMJS_TOKEN`, `QUAY_USERNAME`, `QUAY_ROBOT_TOKEN`, `COUCHDB_*`. Placeholders only, never production creds.

## Done criteria

- At least one representative path passes locally.
- Failing paths are classified: real defect versus local environment limitation.
- CI-only dependencies are listed explicitly before push.
- No secrets leaked to the repo or shell history.
