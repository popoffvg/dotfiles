Separate the **measured fact** from the **inferred cause**. A strong measurement does not make its causal label proven.

## Procedure

1. State the measured number with its source (command + exact output value). This is the fact.
2. State the cause as a hypothesis, explicitly labelled — not as a conclusion.
3. Name the one check that would confirm the cause, and offer to run it.

## The failure mode

A measured skeleton (`148259 goroutines`, `8.5 GiB non-Go RSS`) tempts a confident causal label (`goroutine leak`, `RocksDB block cache`). The count is proven; the cause is not. Attaching the label as settled overstates.

- Measured: `goroutine profile: total 148259` → fact.
- Inferred: "leak" → needs `?debug=2` stack bucketing or a second sample showing growth. Could be legitimate live subscriptions.
- Measured: RSS 12.9 GiB − Go `Sys−HeapReleased` 4.4 GiB = ~8.5 GiB non-Go → fact.
- Inferred: "RocksDB cache" → needs `/proc/<pid>/smaps_rollup` or the subsystem's own stats. Could be mmap, CGO arenas, other native allocs.

## Representative-window trap

A point-in-time sample (a 3 s cgroup delta, one `top` read, a short pprof window) measures only *that instant's* state. Taken while idle, it reports the system as healthy; the real load lives in a different state (under active work). Before calling a load "healthy" / "fine" / "not the problem":

1. Confirm the sample covers the **state that matters** — capture *while* the workload runs (block calculating, request in flight), not at rest.
2. Corroborate the number with a **second independent method** (`top` process % ↔ cgroup `usage_usec` delta ↔ pprof sample %). Agreement upgrades it from "observed" to "measured".
3. A pprof window with a low `Total samples (N%)` is near-idle — its *composition* (where the little CPU went) may still be valid, but its *magnitude* is not the peak. Don't quote it as the load.

Failure seen: "CPU healthy ~60%" from one 3 s idle sample — actual was 94% (`top` 376% ÷ 4 cores) during calculation. The idle sample was real but non-representative.

## pprof undercounts cgo/C CPU

A Go CPU profile (SIGPROF) samples **Go** stacks. CPU spent *inside* C via cgo (e.g. RocksDB) shows only the `runtime.cgocall` entry frame — the C-side work beneath is under-sampled and effectively invisible by default (no `SetCgoTraceback`). Kernel/syscall time is likewise thin. So a **low pprof sample-% next to a high `top`/cgroup reading is not a contradiction** — the gap is off-Go CPU (cgo + syscalls) the profiler can't see. cgroup/`top` account at the OS level and DO count C/cgo CPU fully; they can't be fooled by cgo, so trust them for magnitude and pprof only for the Go-side composition.

Quantify the blind spot over the **same** window: pprof CPU-seconds (`Duration × sample%`) vs cgroup Δ`usage_usec`. cgroup ≫ pprof ⇒ that difference is the cgo/syscall CPU.

**Un-bury it before concluding pprof is useless:** default `-top` puts `runtime.cgocall` at the top as one opaque leaf → reads as runtime overhead. `go tool pprof -peek='cgocall'` shows the C frames beneath it (e.g. `rocksdb_iter_seek` 44%) — the root cause is often *in* the profile, one drill-down under cgocall. Only the C code with no symbolized frames (background C threads) is truly unattributable; for that read the subsystem's own stats.

## Read the constraint, don't derive it

A resource *limit* (CPU quota, memory limit, GOMAXPROCS) is a declared constant, not something to back out of a ratio. Deriving it — "`top` says 371%, the chart says 25%, so the limit is ~15 cores" — inherits every flaw in both inputs and inverts the conclusion when one is wrong. Read the kernel's own view:

- `cat /sys/fs/cgroup/cpu.max` → `<quota> <period>` µs (`400000 100000` = 4 cores; `max 100000` = **no limit**)
- `cat /sys/fs/cgroup/memory.max`
- `go_sched_gomaxprocs_threads` (Go's *own* view, which ignores the cgroup quota unless set explicitly)

Metric sources for limits lie in specific ways: cAdvisor's `container_spec_cpu_quota` emits **`-1` for "no limit"**, so a `sum()` across containers silently subtracts ~10 cores per unlimited sidecar and inflates any percentage built on it. `kube_pod_container_resource_limits` reports the *spec*, which can disagree with the running pod. The cgroup file is what actually constrains the process; when they conflict, it wins.

**Never carry forward a derived number whose input you just called unreliable.** Flagging a denominator as suspect and then using a figure computed from it in the next breath is how "93% of quota, saturated" gets reported as "25%, plenty of headroom."

## The proxy command answers a different question

Ordinary dev tooling fails the same way as a profiler: the command returns a true answer to a *narrower* question than the one being reported. Before stating the finding, name the question the command actually answered.

| Asserted | Command run | What it actually answers | Direct check |
|---|---|---|---|
| "this generated file is stale" | `diff -q a b` (or any exit-code check) | are the bytes identical | read the diff — a one-line version banner is not staleness |
| "the server never starts" | empty output dir + one `grep` of the log | not present in *this* snapshot | re-read the live log; check the rotated `*.log.old` |
| "the feature is unused" | `grep` in one repo | absent from that repo's tracked files | search the consumers, generated code, and config |

Two overreach patterns to catch in your own draft:

0. **Absence claimed from output you truncated.** A listing you piped through `head`/`tail`, a paginated API page, a `--limit`ed query, or a search scoped to what a token can see cannot support "X is not there". Two observed: `find . -type f | head -30` → "the repo has no `.github/` directory" (it had `.github/workflows/build.yaml`, just past the cut); `gh api repos/<org>/<name>` → 404 → "the repo does not exist" (404 also means no access — GitHub does not distinguish). Before asserting absence, re-run the command **unbounded and scoped to the thing itself** (`ls .github/workflows`, `find . -name '.github'`, an org listing that includes private entries), or say "not in the first N results".
1. **Binary verdict from a boolean tool.** `diff -q`, exit codes, and `test -e` collapse a rich difference into yes/no. If the claim is about *what* differs or *why*, the boolean cannot support it. Cost of the direct check: one more command.
2. **"never" / "always" from a point-in-time read.** A directory listing and a log grep are snapshots, exactly like a 3 s cgroup sample. "Absent right now" is not "never happens" — the same log gained the missing line four minutes later. Quantify the claim to what was observed: "no such line as of 15:57", not "it never starts".
3. **Absence from a command that never ran.** Empty output is only evidence if the command executed. `2>/dev/null` on a search collapses *command not found*, *no such directory*, and *permission denied* into the same silent nothing as a genuine zero-match — and the write-up that follows looks fully evidence-backed. Observed: `rg <term> ~/git 2>/dev/null` reported as "0 hits across every local checkout"; `rg` was not installed on that machine, so nothing had been searched. `grep` then found the term in ~20 files including the core SDK definition.
   - **Do not suppress stderr on a search whose emptiness is the finding.** Drop the `2>/dev/null`, or check the exit code — for `grep`/`rg`: `0` matched, `1` no match, `2` error, `127` binary missing. Only `1` supports "not there".
   - **Sanity-check with a term you know is present** before reporting a zero. One positive control separates "the corpus lacks it" from "my search is broken".
   - Assume nothing about which tools exist. A search CLI that is standard elsewhere (`rg`, `fd`, `jq`) may simply be absent here.

**When the user says it exists and your tooling says it does not, suspect the tooling first.** They usually have grounds you cannot see. Re-run the search a different way — a second tool, a positive control, a wider path — *before* contradicting them, and never spend their time asking for a file path or PR link to prove their own claim on the strength of a search you have not verified ran.

A wrong claim that *looks* evidence-backed is worse than an admitted unknown: it spends the reader's trust and they build on it. If the direct check has not run, say "unverified".

## Rule

Even with airtight arithmetic on the *magnitude*, the *attribution* is a leading hypothesis until the confirming check runs. Say "measured X; likely cause Y (unverified — confirm with Z)", never "X because Y". And a magnitude is only the system's load if sampled in the representative state and corroborated by a second method.
