# Failure Category Deep Dives

Detailed diagnosis and fix workflows for each Go test failure category.

---

## Assertion Failures

**Signatures:** `expected X, got Y`, `Not equal:`, `got X want Y`

### Testify output format
```
Error Trace:    /path/to/file_test.go:42
Error:          Not equal:
                expected: 5
                actual  : 6
Test:           TestFoo/subcase_one
Messages:       should return correct sum
```
- `Error Trace:` — exact file and line
- `expected:` / `actual  :` — the mismatch (note spacing)
- `Test:` — full test path including subtest name
- `Diff:` section appears for complex struct comparisons

### Standard library format
```
foo_test.go:42: got 6, want 5
foo_test.go:42: Foo() = 6, want 5
```

### Diagnosis steps
1. Read expected vs actual values — understand what the test specified
2. Read the test case to see what inputs produced the wrong output
3. Read the function under test with those specific inputs in mind
4. Check `git diff` — if test was passing before, the bug is in recent changes
5. For table-driven tests: find the failing case struct by matching the subtest name

### Common causes
- Off-by-one errors
- Changed function signature or behavior without updating tests
- Stale test expectations after refactor
- Floating point comparison without tolerance (`assert.InDelta`)
- Time-dependent values (`time.Now()` in test expectations)
- Map iteration order (non-deterministic in Go — never assert on map order)
- JSON/struct field ordering differences in string comparisons

### Fix strategy
Fix production code, not the test — **unless** the function contract intentionally changed. Check git history for evidence before updating test expectations.

---

## Panics / Nil Pointer Dereference

**Signatures:**
```
panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x1092a9d]

goroutine 1 [running]:
github.com/user/repo/pkg.Foo(...)
    /path/to/file.go:25
```

### Reading stack traces
- Read **top-down** — first frame is where the panic occurred
- `addr=0x0` confirms nil pointer (not corrupt memory)
- Multiple goroutine traces mean panic happened in a goroutine
- The `+0x58` offset after file:line is instruction offset (rarely useful for debugging)

### Diagnosis steps
1. Go to exact file:line from the first stack frame
2. Identify which pointer is nil on that line (method call on nil receiver, field access on nil struct)
3. Trace backwards: where should this have been initialized?
4. Check for unchecked error returns: `result, _ := SomeFunc()` followed by `result.Method()`
5. Check if test setup (mocks, fixtures) is incomplete — missing mock initialization is very common

### Common patterns
- Method call on nil interface: usually means a dependency wasn't injected
- Index out of range: check slice length before access, look for off-by-one in loop bounds
- Nil map write: `var m map[string]int; m["key"] = 1` panics — need `make(map[...]...)`
- Type assertion on nil interface: `val.(ConcreteType)` panics if val is nil

### Fix strategy
Fix the nil source, not the symptom. Do not add nil checks "just in case" — understand WHY it's nil and fix the initialization or error handling.

---

## Race Conditions

**Signature:**
```
WARNING: DATA RACE
Read at 0x00c0000b4010 by goroutine 8:
    github.com/user/repo/pkg.(*Foo).Bar()
        /path/to/file.go:30 +0x58

Previous write at 0x00c0000b4010 by goroutine 7:
    github.com/user/repo/pkg.(*Foo).Baz()
        /path/to/file.go:45 +0x70
```

### Reading race detector output
The output shows two access points:
1. The **current access** (read or write) with its goroutine and location
2. The **previous conflicting access** with its goroutine and location
Both are accessing the same memory address without synchronization.

### Diagnosis steps
1. Note the two file:line locations from the race report
2. Identify the shared variable at those locations
3. Determine which goroutines access it and when
4. Choose synchronization approach:
   - `sync.Mutex` / `sync.RWMutex` — for protecting struct fields or complex state
   - `atomic` package — for simple counters or flags
   - Channels — for goroutine coordination
   - `sync.Once` — for one-time initialization

### Reproducing races reliably
```bash
go test -race -count=5 -run TestSuspect ./package/...
```
Run multiple times — races are timing-dependent.

### Fix strategy
- **Never** use `time.Sleep()` — non-deterministic, will flake
- **Never** ignore the warning — data races are undefined behavior
- Prefer the simplest synchronization that works
- If the shared state can be eliminated (e.g., use local variables), that's better than adding locks

---

## Timeouts and Deadlocks

### Timeout signature
```
panic: test timed out after 30s
running tests:
    TestFoo (30s)

goroutine 123 [chan receive]:
    ...
```

### Deadlock signature
```
fatal error: all goroutines are asleep - deadlock!
```

### Diagnosis steps
1. Look at goroutine states in the stack dump: `chan receive`, `select`, `mutex lock`, `semacquire`
2. Identify which goroutine is blocked and what it's waiting for
3. Check for:
   - Unbuffered channel with no reader/writer on the other side
   - `sync.WaitGroup` with wrong `Add()` count
   - Mutex lock ordering issues (goroutine A holds lock 1 waiting for lock 2, goroutine B holds lock 2 waiting for lock 1)
   - Context not being cancelled — goroutine waits forever on `<-ctx.Done()`

### Useful commands
```bash
# Shorter timeout for faster iteration
go test -timeout 10s -run TestSuspect ./package/...

# Disable timeout to let Go's deadlock detector work
# (test timeout fires before deadlock detection by default)
go test -timeout 0 -run TestDeadlock ./package/...
```

### Fix strategy
- Ensure every channel send has a corresponding receive (and vice versa)
- Use buffered channels when the sender shouldn't block
- Add `context.WithTimeout` to operations that might hang
- Fix `WaitGroup` counts (common: `Add` inside goroutine instead of before `go` statement)
- For mutex ordering: always acquire locks in consistent order across all goroutines

---

## Flaky Tests

**Signature:** Test passes sometimes, fails other times with identical code.

### Reproducing
```bash
# Run many times to reproduce
go test -count=100 -failfast -run TestFlaky ./package/...

# With race detector (slows execution, may surface timing issues)
go test -race -count=10 -failfast -run TestFlaky ./package/...

# With restricted parallelism
go test -p 1 -parallel 1 -count=10 -run TestFlaky ./package/...
```

### Common flakiness sources

**Time-dependent logic:**
- `time.Now()` in assertions — use clock injection or tolerance
- `time.After` / timers with tight margins — increase margins or use fake clocks
- Test assumes operation completes within N ms — fragile on slow CI machines

**Map iteration order:**
- Go randomizes map iteration — never assert on order
- Convert to sorted slice before comparing

**Goroutine scheduling:**
- Race conditions that only manifest under load
- Fix with proper synchronization (see Race Conditions section)

**Port conflicts:**
- Tests binding to hardcoded ports — use `:0` for random port assignment
- Multiple test packages running in parallel claiming same port

**External dependencies:**
- Database connections timing out
- API rate limits
- Network flakiness

**File system state:**
- Temp files not cleaned up between test runs
- Tests writing to same file path
- Use `t.TempDir()` for automatic cleanup

**Global state:**
- Package-level variables mutated across tests
- Singleton patterns without reset
- `init()` functions with side effects

### Fix strategy
Identify and eliminate the source of non-determinism. Never add retries or sleep-based workarounds.

---

## Environment / Fixture Issues

**Signatures:** `open testdata/fixture.json: no such file or directory`, `connection refused`, `REDIS_URL not set`

### Diagnosis steps
1. Check `testdata/` directory exists with required fixtures
2. Check for `TestMain(m *testing.M)` that does setup:
   ```go
   func TestMain(m *testing.M) {
       // setup code here
       os.Exit(m.Run())
   }
   ```
3. Check environment variables the test expects:
   ```bash
   grep -r "os.Getenv\|os.LookupEnv" ./package/*_test.go
   ```
4. Check build tags gating integration tests:
   ```bash
   grep -r "//go:build\|// +build" ./package/*_test.go
   ```
5. Check if test uses `os.Getwd()` and depends on specific working directory
6. Check for Docker/compose dependencies in `TestMain` or CI config

### Fix strategy
- For missing fixtures: create them or skip with `t.Skip("requires testdata/...")`
- For missing env vars: document requirements, add `t.Skip` when not set
- For build tag issues: run with correct tags: `go test -tags integration ./...`
- For Docker dependencies: ensure services are running or skip gracefully

---

## Build / Compilation Errors

**Signature:**
```
# github.com/user/repo/pkg
./file_test.go:15:2: undefined: SomeFunc
FAIL    github.com/user/repo/pkg [build failed]
```

### Diagnosis steps
1. This is NOT a test failure — the code doesn't compile
2. Separate test vs production compilation:
   ```bash
   go build ./...            # production code only
   go test -c ./package/...  # compile test binary
   ```
3. Run static analysis: `go vet ./...`

### Common causes
- Renamed or removed function — test references old name
- Wrong package import
- Build tag mismatch: test file has `//go:build integration` but test runs without tag
- Circular imports between test and production packages
- Missing generated code (protobuf, mock generation, etc.)

### Fix strategy
Fix the compilation error. If function was renamed, update references. If generated code is missing, run the generator (`go generate ./...`, `mockgen`, `protoc`, etc.).
