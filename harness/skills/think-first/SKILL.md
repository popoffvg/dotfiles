---
name: think-first
description: >-
  This skill should be used before implementing a requested change to estimate
  task size and risk, especially for deployments, migrations, and infrastructure
  setup, even when the user has not asked for a plan. Reassess when scope grows
  or new operational risks appear.
user-invocable: false
---
# Think first

1. **Estimate before changing.** Inspect enough session context, repository evidence,
   and, for deployments, live state to classify the whole requested outcome.
   Estimate size and risk separately using the calibration below; a short command
   can still be critical.
   For work requiring a plan, state both estimates and their concrete reasons.

2. **Choose the planning path.** Plan before implementation when size is **medium
   or large**, or risk is **high or critical**. Small work below high risk proceeds
   directly. Read any plan already requested or created in this session or project:
   reuse it if it covers the current scope, update its gaps otherwise. A user
   request for a plan enters that workflow even below the threshold; a request
   for planning alone ends with the verified plan. Respect an explicit instruction
   to skip planning, while keeping its concrete risk assessment visible.

3. **Write the plan.** Use the project's established planning workflow and location;
   otherwise write a concise plan in chat. Cover the intended outcome and scope,
   current state and assumptions, ordered changes and dependencies, acceptance
   checks, and failure recovery. For operational changes, include affected services
   and state, cutover order, downtime, rollback feasibility, and abort conditions.
   Honor constraints already settled in the session, including backup decisions.
   Done when each consequential step has a prerequisite and an observable check.

4. **Verify before executing.** Walk the plan against repository and live evidence:
   check prerequisites, ordering, resource capacity, state preservation, permissions,
   competing writers, failure paths, and whether the proposed checks prove the
   outcome. Use the project's plan verifier when available; otherwise perform a
   separate adversarial review pass. Fix findings and record the verdict and any
   unresolved assumptions. Verification passes only when no unresolved issue can
   invalidate execution or recovery; resolve such issues before affected changes.
   Then continue within existing authorization. Planning adds no approval gate;
   preserve any gate already required by the user or project workflow.

5. **Reassess changed scope.** New services, persistent state, controllers, or a wider
   rollout can cross the threshold even inside an ongoing task. Update and verify
   the affected plan before implementing that expansion. An unchanged, verified
   plan remains valid; execute its acceptance checks after implementation.

## Calibration

| Dimension | Estimate | Evidence |
|---|---|---|
| Size | Small | One bounded adjustment with a known approach and few dependencies. |
| Size | Medium | Several dependent changes or components needing coordinated validation. |
| Size | Large | Platform migration, new operating model, or broad service rollout. |
| Risk | Low | Local, easily reversed, with negligible operational impact. |
| Risk | Moderate | Limited service impact with a known, practical recovery path. |
| Risk | High | Material outage, security exposure, persistent-state changes, or uncertain recovery. |
| Risk | Critical | Shared infrastructure or identity failure, irreversible data loss, or broad loss of access. |

Calibration anchors:

- **Migrate services to k3s:** large and critical; plan and verify before migration.
- **Add Flux:** large; plan and verify controller ownership and release adoption.
- **Change Supervoc setup:** small for a bounded configuration adjustment. Assess
  risk independently; a destructive or access-affecting change still needs a plan.
