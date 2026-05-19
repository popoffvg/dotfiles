---
name: go-debug
description: Reference guide for interactive Go debugging with Delve (dlv) — breakpoints, stepping, variable inspection, goroutine debugging, race conditions, deadlocks. Skip for simple bugs.
---

# Go Debug with Delve

Use Delve (dlv) to debug Go applications interactively. Set breakpoints, inspect variables, and step through Go code execution.

## When to Use This Skill

**Use when:**
- Complex runtime bug with unclear cause
- Need to inspect live variable state at breakpoint
- Understanding intricate control flow
- Debugging goroutine interactions or channels
- Reproduction requires stepping through execution

**Skip when:**
- Bug is obvious from error message (just fix it)
- Logs/stack traces provide enough info
- Simple nil pointer or assertion failure
- Can add `t.Logf()` and re-run test instead

## Prerequisites

- Delve installed: `go install github.com/go-delve/delve/cmd/dlv@latest`
- Go code that compiles successfully
- Test files for debugging tests

## Common Workflows

### Debug a Test

```bash
# Debug specific test
dlv test -- -test.run TestName

# Debug test with timeout
dlv test -- -test.run TestName -test.timeout 30s

# Debug with environment variables
ENV_VAR=true dlv test -- -test.run TestName
```

Inside dlv:
- `break file.go:123` - Set breakpoint at line
- `break TestFunctionName` - Break at function start
- `continue` or `c` - Run until breakpoint
- `next` or `n` - Step over
- `step` or `s` - Step into
- `print varName` or `p varName` - Print variable
- `locals` - Show local variables
- `args` - Show function arguments
- `goroutines` - List all goroutines
- `goroutine <id>` - Switch to goroutine
- `stack` or `bt` - Show stack trace
- `list` - Show current code location
- `restart` or `r` - Restart program
- `quit` or `q` - Exit debugger

### Debug an Application

```bash
# Debug binary
dlv exec ./myapp -- --config config.yaml

# Debug with compilation
dlv debug ./cmd/myapp -- --log-level debug

# Attach to running process
dlv attach <pid>

# Remote debugging (headless mode)
dlv debug --headless --listen=:2345 --api-version=2 --log ./cmd/myapp
```

### Debug with Breakpoints from Start

```bash
# Create breakpoint file
cat > /tmp/breakpoints.txt <<EOF
break main.go:42
break controllers/runner/process.go:156
condition 2 jobID == "test-123"
continue
EOF

# Start with breakpoints
dlv test -- -test.run TestName < /tmp/breakpoints.txt
```

## VSCode Integration

If the project has `.vscode/launch.json`, use its launch configurations for debugging. Common patterns:
- **Test** — Debug tests with dlv
- **Connect to Delve** — Attach to remote Delve (headless mode on port 2345)

## Useful Commands

```bash
# Find test function line number
grep -n "^func.*TestName" file_test.go

# Check if process is running
ps aux | grep dlv

# Kill hung dlv session
pkill -9 dlv

# Debug with core dump
dlv core ./binary ./core.dump
```

## Debugging Strategies

### Race Conditions
1. Run with race detector: `go test -race`
2. Set breakpoints in suspicious goroutines
3. Use `goroutines` to see all running goroutines
4. Switch with `goroutine <id>` to inspect each
5. Check for shared variable access patterns

### Deadlocks
1. Let program hang
2. Send SIGQUIT: `kill -QUIT <pid>` (prints goroutine stacks)
3. Or attach dlv: `dlv attach <pid>`
4. Use `goroutines` to see all goroutines
5. Check each goroutine's stack for lock waits

### Test Failures
1. Add breakpoint before assertion: `break suite_test.go:234`
2. Run: `dlv test -- -test.run TestName`
3. When stopped, inspect: `p actualValue`, `p expectedValue`
4. Check surrounding state: `locals`, `args`
5. Step through with `next` to understand flow

### Complex Logic
1. Set breakpoint at function entry
2. Step through with `next` (over) or `step` (into)
3. Print variables at each step: `p varName`
4. Use `list` to see current location
5. Use `finish` to run until function returns

## Tips

- Compile with `-gcflags="all=-N -l"` to disable optimizations for better debugging
- Use conditional breakpoints: `condition <bp-num> <expression>`
- Clear breakpoints: `clear <bp-num>` or `clearall`
- Disable breakpoint: `toggle <bp-num>`
- Watch expressions: `print` doesn't have persistent watches, re-run as needed
- For long-running tests, increase timeout: `-test.timeout 5m`
- Check project-level `.claude/rules/` for test-specific patterns if they exist

## Common Issues

**"could not launch process: decoding dwarf section info"**
- Solution: Recompile without build cache: `go clean -cache && go test`

**Breakpoint not hit**
- Check if code path is actually executed
- Verify line number with `list`
- Try function name instead: `break FunctionName`

**Variables optimized away**
- Rebuild with: `go test -gcflags="all=-N -l"`

**Can't attach to process**
- macOS: May need to codesign dlv or disable SIP
- Linux: May need `sudo` or `CAP_SYS_PTRACE` capability

## Integration with CI/Test Logs

When tests fail in CI:
1. Check test logs for the failure point (grep for "FAIL" or error messages)
2. Set breakpoint just before failure
3. Run locally with dlv to inspect state

## References

- Delve docs: https://github.com/go-delve/delve/tree/master/Documentation

## Autoresearch rules

**Eval checklist:**
1. Was Delve used only when the bug was complex enough to warrant it (not for obvious fixes)?
2. Did the agent set breakpoints at specific locations (not "break main")?
3. Was the bug root cause found using variable inspection or stepping (not by guessing)?
4. Did the debugging session produce a concrete fix (not just "found the issue")?

**Test inputs:**
- "Debug goroutine leak in HTTP server shutdown"
- "Debug race condition between two concurrent map writers"
- "Debug unexpected nil return from interface method"

**Can change:** breakpoint strategy, stepping workflow, goroutine inspection steps, when-to-use criteria
**Cannot change:** Delve as the debugging tool, skip-when criteria for simple bugs
**Min sessions before eval:** 5
**Runs per experiment:** 3
