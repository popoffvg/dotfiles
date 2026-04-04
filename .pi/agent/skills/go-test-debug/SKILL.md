---
name: go-test-debug
description: Debug complex Go test failures — flaky tests, race conditions, deadlocks, panics, timeouts, nil pointer dereferences. Systematic error-first diagnosis workflow.
argument-hint: [test-name or paste failure output]
---

# Go Test Failure Debugging

Systematic workflow for AI agents to diagnose and fix Go test failures. Optimized for token-efficient debugging — read errors first, isolate fast, fix with evidence.

## When to Use This Workflow

**Skip for simple failures** - fix immediately if:
- Single assertion mismatch with obvious fix
- Typo in test expectations
- Known issue after recent code change

**Use full workflow for:**
- Unknown failure cause
- Flaky/intermittent failures
- Complex panics, race conditions, deadlocks

## Core Principle: Error-First, Evidence-Driven

**NEVER** read production code before reading error message. Reading order:
1. Error message / assertion output
2. Test function that failed
3. Production code under test
4. `git diff` for recent changes

## Phase 1: Collect and Classify

### Step 1: Run the failing test and capture output

**CRITICAL:** If no specific test name is given, run the full package test first and **save the output to a file** before doing anything else. This raw output is the single most important artifact — it contains error messages, stack traces, and line numbers that guide the entire debugging process.

```bash
# When specific test is NOT known — save output for analysis
go test -v -count=1 ./package/... 2>&1 | tee /tmp/test-output.txt

# Then find failing tests from saved output
grep -E "^--- FAIL:" /tmp/test-output.txt
```

Once the failing test is identified, re-run it isolated:
```bash
go test -v -count=1 -run TestName ./package/...
```

Flags explained:
- `-v` — show all output including `t.Log`
- `-count=1` — bypass test cache (cached results show `(cached)` — stale data during debugging)
- `-run` — isolate the specific test; subtests use `/`: `-run "TestFoo/case_name"`

For machine-parseable output when failure is complex:
```bash
go test -json -count=1 -run TestName ./package/... 2>&1 | jq 'select(.Action == "fail")'
```

### Step 2: Classify the failure

Read the output and classify into one of these categories:

| Category | Signature in output | Jump to |
|---|---|---|
| Build error | `[build failed]`, `undefined:`, `cannot use` | **references/categories.md § Build Errors** |
| Assertion failure | `expected X, got Y`, `Not equal:`, `got X want Y` | **references/categories.md § Assertion Failures** |
| Panic / nil pointer | `panic:`, `nil pointer dereference`, stack trace | **references/categories.md § Panics** |
| Race condition | `WARNING: DATA RACE` | **references/categories.md § Race Conditions** |
| Timeout / deadlock | `test timed out`, `all goroutines are asleep` | **references/categories.md § Timeouts** |
| Flaky test | Passes sometimes, fails other times | **references/categories.md § Flaky Tests** |
| Environment / fixtures | `no such file`, `connection refused`, env var missing | **references/categories.md § Environment Issues** |

## Phase 2: Diagnose

### Layered verification (stop at first failure)

Run checks in order:
1. `go build ./...` — does it compile?
2. `go vet ./...` — static analysis issues?
3. `go test -v -count=1 -run TestSpecific ./package/...` — specific test
4. `go test -race -count=1 ./package/...` — race conditions?

### Diff-driven diagnosis

Check what changed recently — the bug is almost always in the diff:
```bash
git diff HEAD~3 -- ./package/
git log --oneline -5 -- ./package/
```

### Subtest drilling (table-driven tests)

```bash
go test -v -run TestFoo ./package/...                  # see all subtests
go test -v -run "TestFoo/failing_case" ./package/...   # isolate one case
```

Spaces in subtest names become `_` in the regex. Find the case struct in test code by matching the name field.

### External dependency check

Before debugging logic, verify the test isn't failing due to environment:
- Check for `TestMain(m *testing.M)` setup/teardown
- Check `testdata/` directory for required fixtures
- Look for `os.Getenv` / `os.LookupEnv` in test files
- Check build tags: `//go:build integration`
- Look for hardcoded ports: `localhost:5432`, `:6379`, etc.

## Phase 3: Fix

### Fix strategy by category

- **Assertion failure** → Fix production code (usually). Only update test expectations if the function contract intentionally changed (check git history for evidence).
- **Panic** → Trace nil pointer backwards from crash site to missing initialization. Check unchecked error returns: `result, _ := Func()`.
- **Race condition** → Add proper synchronization (`sync.Mutex`, channels, `atomic`). **Never use `time.Sleep()`**.
- **Timeout** → Find blocked goroutine in stack dump. Check unbuffered channels, wrong `WaitGroup` counts, mutex ordering.
- **Flaky** → Identify non-determinism source (time, maps, goroutines, global state, ports). Fix the root cause.

### Validation after fix

```bash
# Verify the fix
go test -v -count=1 -run TestName ./package/...

# Run broader to catch regressions
go test -count=1 ./package/...

# Race check
go test -race -count=1 ./package/...
```

### When to use Delve vs `t.Logf()`

- **Prefer `t.Logf()`** for temporary debug output — it only prints on failure or with `-v`, and stays clean
- **Use Delve** when: complex state inspection needed, deeply nested code, or `t.Logf()` doesn't give enough visibility
- Use `go-debug` skill for Delve workflows
- **Never use `fmt.Println`** in tests — use `t.Logf()` instead
- **Clean up** all debug logging before committing the fix

## Quick Decision Tree

```
Test failed
├── Doesn't compile? → go build ./... → fix compilation
├── Read error message → classify type:
│   ├── "expected X, got Y" → read test inputs → read function → check diff → fix code
│   ├── "panic:" → read stack trace top frame → go to file:line → find nil pointer → trace back
│   ├── "DATA RACE" → note two locations → identify shared var → add sync primitive
│   ├── "test timed out" → check goroutine states → find blocked chan/mutex → fix
│   ├── "no such file" / "connection refused" → check fixtures/env/TestMain
│   └── Intermittent → go test -count=100 -failfast → find non-determinism source
└── After fix: go test -v -count=1 + go test -race
```

## Key Commands

```bash
# Essential debugging commands
go test -v -count=1 -run TestName ./pkg/...     # isolated, no cache
go test -race -count=1 ./pkg/...                 # race detector
go test -count=100 -failfast -run TestX ./pkg/... # reproduce flaky
```

## Additional Resources

For detailed diagnosis per failure type, see **`references/categories.md`**
