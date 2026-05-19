---
name: act-local-github-actions-testing
description: Run and debug GitHub Actions locally with `act`, including job filtering, secrets injection, event payload simulation, reusable workflow checks, and pl-repo-specific constraints.
---

# Act Local GitHub Actions Testing

Run GitHub Actions workflows locally with [`act`](https://github.com/nektos/act) to validate workflow logic before pushing.

## When to use

Use this skill when you need to:
- Validate `.github/workflows/*.y*ml` changes quickly
- Reproduce CI behavior locally
- Debug `if`, `matrix`, `needs`, `concurrency`, and reusable-workflow wiring
- Smoke-test PR/push/workflow_dispatch triggers without remote CI cycles

## Base workflow

1. Identify target workflow and event.
2. Run only relevant jobs first (`--job`).
3. Inject required secrets/vars.
4. Use a realistic event payload (`--eventpath`).
5. Expand to broader jobs only after targeted pass.

## Core commands

```bash
# List workflows/jobs as seen by act
act --list

# Run pull_request event
act pull_request

# Run only one job
act pull_request -j lint

# Run manual dispatch workflow
act workflow_dispatch -W .github/workflows/trigger-commit-pr.yaml

# Use explicit event payload
act pull_request --eventpath .github/events/pr.json

# Provide secrets
act pull_request -s GITHUB_TOKEN=ghp_xxx -s GH_CI_PAT=xxx

# Use env file / vars
act pull_request --env-file .env.act
```

## Safety defaults

- Start with **one job** (`-j <job>`) instead of whole workflow.
- Prefer Linux container runner mapping for compatibility.
- Use fake or scoped tokens for local-only checks.
- Never commit `.env.act` or secret files.

## pl repo instructions (from local workflow patterns)

These are specific to `mil/pl` workflows and should be applied when testing that repo locally.

### 1) Prefer targeted jobs first
`pl` workflows include many jobs that depend on private actions, cloud auth, or self-hosted runners.

Start from low-coupling jobs:
- `lint` reusable workflow chain
- `actionlint` job in `.github/workflows/lint.yaml`

Avoid running full `trigger-commit-pr.yaml` in one shot initially.

### 2) Self-hosted runner mismatch
`pl` uses runners like `dev-ci-pl`, `rockylinux8-amd64`, etc. Local `act` won’t replicate those exactly.

Use local smoke checks for logic/syntax; treat environment-specific behavior as needs-verification in CI.

### 3) Private action dependencies
`pl` heavily uses:
- `milaboratory/github-ci/actions/*`
- `milaboratory/github-ci-internal/actions/*`

Local `act` may fail pulling these without org access/token.

Recommended approach:
- Test workflow wiring and conditions with jobs that don’t require private actions first.
- For private-action jobs, run narrow dry checks and validate final behavior in GitHub CI.

### 4) Required secrets surface (pl)
Common secrets referenced in workflows:
- `MI_LICENSE`
- `GH_CI_PAT`
- `AWS_CI_TURBOREPO_S3_BUCKET`
- `NPMJS_TOKEN`
- `QUAY_USERNAME`
- `QUAY_ROBOT_TOKEN`
- `COUCHDB_*`

Use placeholder/local test secrets where possible; do not use production creds.

### 5) Reusable workflow structure
`pl` composes workflows via `workflow_call` and `secrets: inherit` (for example: `trigger-commit-pr.yaml` calls `lint.yaml`, `build-multiplatform.yaml`, `test.yaml`).

Local strategy:
1. Validate callee workflow standalone where possible.
2. Then validate caller orchestration logic (`needs`, conditions, dispatch inputs).

### 6) workflow_dispatch path
`trigger-commit-pr.yaml` has `workflow_dispatch` with `deploy-staging` boolean.

Use explicit dispatch payloads when testing dispatch-only branches:
- dispatch with `deploy-staging=false` first
- then `true` only if secrets/mocks are prepared

### 7) Concurrency and conditional logic checks
`pl` uses concurrency groups and event-specific conditions (`github.event_name`, `github.ref`, PR-only comments).

Always test at least:
- PR payload path
- push-to-main path
- workflow_dispatch path

## Suggested local test matrix (pl)

1. `lint.yaml` -> `actionlint` job only
2. `trigger-commit-pr.yaml` PR event with `deploy-staging=false`
3. `trigger-commit-pr.yaml` workflow_dispatch with `deploy-staging=false`
4. optional: targeted build/test sub-jobs that do not require private infra

## Preflight checklist

- `.github/workflows` changed files identified
- event payload file prepared
- secrets file prepared (sanitized)
- selected job can run without unavailable infra
- expected skip/fail reasons documented before run

## Troubleshooting

- **Action pull/auth errors**: confirm token scope for private action repos.
- **Runner label issues**: local mismatch; constrain to testable jobs.
- **Secret missing**: add explicit `-s` or `--secret-file` entry.
- **Condition surprises**: print context vars and validate event payload fields.

## Done criteria

A local act verification is complete when:
- Target workflow syntax and job graph are validated for intended event(s)
- At least one representative path passes locally
- Non-local dependencies are explicitly listed for CI-only validation
- No secrets are leaked to repo or shell history files
