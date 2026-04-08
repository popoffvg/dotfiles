---
name: k8s-connection
description: Use when connecting to a Platforma instance running in Kubernetes. Covers port-forwarding, endpoint checks, pod/job diagnostics, and a fast “find the issue” triage flow.
---

# K8s Connection & Triage

Connect to and debug a Platforma instance running in Kubernetes.

## Use This Skill When

- User asks to connect to a k8s-hosted Platforma
- User asks to debug failures in CI or staging clusters
- User says “find the issue”, “why failed”, “what is broken”, or similar

## Fast Triage (Use First for “find the issue”)

Run these checks in order and stop when the root cause is clear.

```bash
# 1) Confirm context/namespace
kubectl config current-context
kubectl get ns

# 2) Deployment and pod health
kubectl get deploy,pods -n <namespace> -o wide
kubectl get pods -n <namespace> --sort-by=.status.startTime

# 3) Recent warnings/errors
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -50

# 4) App logs (current + previous)
kubectl logs deployment/<platforma-deployment> -n <namespace> --tail=200
kubectl logs deployment/<platforma-deployment> -n <namespace> --previous --tail=200
```

If jobs are involved, immediately add:

```bash
kubectl get jobs -n <namespace>
kubectl describe job <job-name> -n <namespace>
kubectl logs job/<job-name> -n <namespace> --tail=200
```

## Port-Forward Setup

```bash
# Forward debug API and metrics from Platforma deployment
kubectl port-forward deployment/<platforma-deployment> -n <namespace> 9091:9091 9090:9090
```

After this, use `localhost:9091` for debug API and pl-db-cli calls.

## Verify Endpoint Before Deeper Debugging

```bash
# If auth is disabled:
curl -sf http://localhost:9091/debug/health || true

# If service address is used in tests:
kubectl get svc -n <namespace>
```

If endpoint is unreachable, debug networking/readiness before test logic.

## Enabling Debug API on Running Deployment

```bash
kubectl set env deployment/<platforma-deployment> -n <namespace> \
  PL_DEBUG_ENABLED=true PL_DEBUG_PORT=9091 PL_DEBUG_IP=0.0.0.0
kubectl rollout status deployment/<platforma-deployment> -n <namespace>
```

Re-establish port-forward after rollout.

**Requirement:** `PL_DEBUG_IP=0.0.0.0` is required for port-forward access.

## Finding Correct Deployment/Pod

```bash
kubectl get deployments --all-namespaces | grep -i platforma
kubectl get pods -n <namespace> -l app=<label>
kubectl describe pod <pod-name> -n <namespace>
```

## Common Failure Signatures

- `ImagePullBackOff` / `ErrImagePull` → wrong image/tag or registry auth
- `FailedScheduling` / `Insufficient cpu|memory` → cluster capacity or requests too high
- `CrashLoopBackOff` / `OOMKilled` → app startup failure or memory limits too low
- `BackoffLimitExceeded` on Job → retry exhausted; inspect pod logs/events
- `Forbidden` on kubectl actions (`pods/exec`, `secrets`, etc.) → RBAC issue

## Runner/Batch Diagnostics

```bash
kubectl get appwrappers -n <namespace> 2>/dev/null || true
kubectl get workloads -n <namespace> 2>/dev/null || true
kubectl get pvc -n <namespace>
kubectl describe pod <job-pod> -n <namespace>
```

Use these when Kueue or PVC/workdir behavior is suspected.

## Port-Forward Drops

```bash
pkill -f "port-forward.*<platforma-deployment>" || true
kubectl port-forward deployment/<platforma-deployment> -n <namespace> 9091:9091 9090:9090
```

## Multiple Replicas

If multiple replicas exist, target a fixed pod to avoid random routing:

```bash
kubectl port-forward pod/<pod-name> -n <namespace> 9091:9091
```

## Response Contract

When reporting findings, always include:
1. failing resource (`pod/job/deploy`) and namespace
2. exact failure signal (event/log line)
3. likely root cause in one sentence
4. next command to confirm or fix
