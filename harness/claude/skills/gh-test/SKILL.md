---
name: gh-test
description: Test GitHub Actions locally using `@kie/act-js` (CLI + API), including event simulation, job-level runs, secret/env injection, and pl-repo-safe local validation.
---

# GH Test (act-js)

Use [`@kie/act-js`](https://github.com/kiegroup/act-js) to run GitHub Actions locally as CLI or programmatic API.

## When to use

- You changed `.github/workflows/*.y*ml`
- You need fast local feedback before push
- You want deterministic workflow tests in JS/TS (API mode)
- You need event payload, secret, env, or input simulation

## Prerequisites

- Docker running (required by act-js)
- Node.js project context for API usage
- No Podman assumption (act-js officially targets Docker)

## Install / quick checks

```bash
npm i @kie/act-js
npx act-js --version
```

## CLI-first workflow

```bash
# discover jobs
npx act-js --list

# run one event
npx act-js pull_request

# run one job only
npx act-js pull_request -j lint

# custom workflows dir
npx act-js pull_request -W .github/workflows
```

## API workflow (recommended for repeatable tests)

```ts
import { Act } from "@kie/act-js";

const act = new Act(process.cwd(), ".github/workflows")
  .setSecret("GITHUB_TOKEN", process.env.GITHUB_TOKEN ?? "test-token")
  .setEnv("CI", "true")
  .setInput("deploy-staging", "false")
  .setEvent({ pull_request: { head: { ref: "feature/test" } } });

// list workflows/jobs
const workflows = await act.list("pull_request");

// run a single job
const jobResult = await act.runJob("lint");

// run all jobs for an event
const eventResult = await act.runEvent("pull_request");
```

## Key act-js API surface

- `new Act(cwd?, workflowFile?)`
- `setSecret()` / `deleteSecret()` / `clearSecret()` / `setGithubToken()`
- `setEnv()` / `deleteEnv()` / `clearEnv()` / `setGithubStepSummary()`
- `setInput()` / `deleteInput()` / `clearInput()`
- `setEvent(payload)`
- `list(event?)`
- `runJob(jobId, options?)`
- `runEvent(eventName, options?)`
- `runEventAndJob(eventName, jobId, options?)`

Run options (important):
- `cwd`, `workflowFile`
- `bind`
- `artifactServer`
- `mockApi`
- `mockSteps`
- `logFile`
- `verbose`

## Mocking guidance

Use `Mockapi` with `mockApi` options when actions call HTTP(S) APIs.
Prefer this for stable tests over real network calls.

## Deep examples from act-js repo

### Example A: list workflows for an event
(From `test/it/act.test.ts` pattern)

```ts
const act = new Act();
const list = await act.list("pull_request", __dirname, "./resources");
// returns [{ jobId, jobName, workflowName, workflowFile, events }, ...]
```

Use this before runs to avoid wrong `jobId` assumptions.

### Example B: run one job with secret+env
(From `test/it/act.test.ts`)

```ts
const output = await new Act()
  .setSecret("SECRET1", "secret1")
  .setEnv("ENV1", "env")
  .runJob("push1", { workflowFile: "./resources", cwd: __dirname });
```

Use for narrow, deterministic smoke tests.

### Example C: run event with explicit payload
(From README event section + integration test style)

```ts
const output = await new Act()
  .setEvent({ pull_request: { head: { ref: "feature/my-branch" } } })
  .runEvent("pull_request", { workflowFile: ".github/workflows" });
```

Use when workflow logic depends on `github.event.*` fields.

### Example D: run event + specific job
(From API surface: `runEventAndJob`)

```ts
await new Act().runEventAndJob("pull_request", "lint", {
  workflowFile: ".github/workflows",
  verbose: true,
  logFile: ".tmp/act-lint.log",
});
```

Use when one job in a multi-job workflow is failing.

### Example E: mock external API calls
(From `test/it/act.test.ts` and README Mockapi section)

```ts
import { Mockapi } from "@kie/act-js";

const mockapi = new Mockapi({
  google: {
    baseUrl: "http://google.com",
    endpoints: {
      root: { get: { path: "/", method: "get", parameters: { query: [], path: [], body: [] } } },
    },
  },
});

await new Act().runJob("mock", {
  workflowFile: "./resources",
  mockApi: [mockapi.mock.google.root.get().setResponse({ status: 200, data: "mock response" })],
});
```

Use to remove flaky network dependencies.

### Example F: mock steps inside workflow
(From `test/it/act.test.ts` + `test/unit/step-mocker/step-mocker.test.ts`)

```ts
await new Act("./resources").runJob("push1", {
  mockSteps: {
    push1: [
      { name: "secrets", mockWith: "echo secrets" },
      { run: "echo $ENV1", mockWith: "echo some env" },
    ],
  },
});
```

Step matching can use `id`, `name`, `uses`, `run`, or step `index`.

### Example G: workflow under test in upstream repo
Upstream keeps a minimal workflow example at:
- `.github/workflows/ci-checks.yaml` (triggered on pull_request for workflow changes)

Use it as a shape template for lightweight workflow tests.

### External examples referenced by act-js README
- `https://github.com/shubhbapna/mock-github-act-js-examples/tree/main/custom-actions/javascript`
- `https://github.com/shubhbapna/mock-github-act-js-examples/tree/main/workflow/github-script`

## pl repo profile (local-safe)

For `/Users/popoffvg/Documents/git/mil/pl` workflows:

1. Start with low-coupling jobs (`lint`, `actionlint`) before full orchestration.
2. Expect local mismatch for self-hosted runner labels (`dev-ci-pl`, `rockylinux8-amd64`).
3. Many jobs rely on private actions (`milaboratory/github-ci/*`, `github-ci-internal/*`) and org secrets.
4. Use `workflow_dispatch` with explicit input payloads (e.g. `deploy-staging=false`) first.
5. Mark cloud/private-action-dependent paths as **CI-only verification required**.

Common secret names referenced in pl workflows:
- `MI_LICENSE`, `GH_CI_PAT`, `AWS_CI_TURBOREPO_S3_BUCKET`, `NPMJS_TOKEN`
- `QUAY_USERNAME`, `QUAY_ROBOT_TOKEN`
- `COUCHDB_*`

## Verification checklist

- [ ] Target job/event selected (not full workflow first)
- [ ] Event payload explicit (`setEvent` / `-e` equivalent)
- [ ] Secrets/envs injected minimally
- [ ] Logs captured (`logFile` for API mode)
- [ ] Local-only failures classified vs CI-only dependencies

## Done criteria

A workflow change is locally verified when:
- at least one representative path passes via act-js,
- failing paths are mapped to real defects vs environment limitations,
- CI-only dependencies are explicitly listed before push.
