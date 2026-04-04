---
name: shell-modify
description: Safe shell script modifications — pre-edit analysis of strict modes, resource cleanup patterns, portability checks, and shellcheck validation. Use for any non-trivial shell script edits (.sh, .bash). Skip for one-line fixes.
argument-hint: [script-path]
---

# Shell Script Modification Skill

Systematic workflow for safely modifying shell scripts. Prevents the most common agent mistakes: missing cleanup traps, violating strict mode contracts, and non-portable constructs.

For patterns, idioms, and a full script template, see **`references/best-practices.md`**.

## When to Use

**Use when:**
- Modifying scripts with `set -e` / `set -eu` / `set -o pipefail`
- Adding temp files, subprocesses, or background jobs to scripts
- Changing scripts that run in CI, containers, or k8s jobs
- Multi-function or multi-file shell changes
- Writing new shell scripts from scratch

**Skip when:**
- One-line fix to a simple script
- Adding a comment or changing a string literal
- User says "just fix it" for an obvious typo

## PHASE 1: Pre-Edit Analysis

Before making any changes, read the ENTIRE script and fill this checklist:

### Strict mode audit
- [ ] **Shebang**: `#!/bin/bash`, `#!/bin/sh`, `#!/usr/bin/env bash`? This determines which features are safe (see **`references/best-practices.md` § Portability**).
- [ ] **Strict flags**: `set -e` (errexit), `set -u` (nounset), `set -o pipefail`? Note the exact combination and line number.
- [ ] **Existing traps**: any `trap` commands? What signals? What cleanup? New traps must compose with existing ones, not replace them.
- [ ] **Error handling pattern**: does the script use `|| true`, `|| :`, `if ! cmd; then`, explicit return codes? Match the style.

### Implications of strict modes

**`set -e` (errexit):**
- Any command returning non-zero exits the script immediately
- Cleanup code after a failing command NEVER runs — use `trap ... EXIT` instead
- `mktemp` without trap = leaked temp files on any failure
- Commands in `if` conditions, `||`, `&&` are exempt from errexit
- `local var=$(cmd)` masks the exit code of `cmd` — split into two lines: `local var; var=$(cmd)`

**`set -u` (nounset):**
- Unset variables cause immediate exit
- Use `${var:-default}` for optional variables (see **`references/best-practices.md` § Default Values**)
- Array access `${arr[@]}` fails if array is empty in bash < 4.4 — use `${arr[@]+"${arr[@]}"}`

**`set -o pipefail`:**
- Pipeline fails if ANY command fails (not just the last)
- `cmd | grep pattern` fails if `cmd` fails, even if grep succeeds
- `cmd | grep pattern || true` if grep finding nothing (rc=1) is expected

### Resource lifecycle checklist
If your change creates resources, verify cleanup:

| Resource | Cleanup pattern |
|----------|----------------|
| `mktemp` / `mktemp -d` | `trap 'rm -rf "$tmpdir"' EXIT` immediately after creation |
| Background process (`&`) | `trap 'kill "$pid" 2>/dev/null' EXIT` |
| `flock` / lock files | `trap 'rm -f "$lockfile"' EXIT` |
| Mounted filesystems | `trap 'umount "$mnt"' EXIT` |
| Changed directory (`cd`) | Use subshell `( cd dir && ... )` or `pushd`/`popd` |
| Modified env/shell opts | Save and restore: `old_opts=$(set +o); ... ; eval "$old_opts"` |

**Rule: one trap handler per script.** If a trap already exists, extend it — don't add a second `trap ... EXIT` (it replaces the first). Pattern:

```bash
cleanup() {
    rm -rf "$tmpdir"
    # add more cleanup here
}
trap cleanup EXIT
```

See **`references/best-practices.md` § Trap for Cleanup** and **§ Temporary Files** for full patterns.

### Execution environment
- [ ] **Where does this run?** Local shell, CI runner, Docker container, k8s job?
- [ ] **What's available?** Don't assume `jq`, `curl`, `realpath` exist. Use `command -v` to guard (see **`references/best-practices.md` § Check Command Existence**).
- [ ] **Which shell version?** `bash 3.x` (macOS default) lacks associative arrays, `readarray`, `${var,,}`.

## PHASE 2: Make Changes

1. Edit using exact text replacement
2. Follow the existing code style (indentation, quoting, variable naming)
3. **Always quote variables**: `"$var"`, not `$var` — especially in file paths and command arguments
4. **Always quote command substitutions**: `"$(cmd)"`, not `$(cmd)`
5. For new scripts, follow the template in **`references/best-practices.md` § Complete Script Template**

### Common patterns for errexit scripts

```bash
# WRONG — cleanup never runs if cmd fails
tmpfile=$(mktemp)
cmd > "$tmpfile"
rm -f "$tmpfile"

# RIGHT — trap ensures cleanup on any exit
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT
cmd > "$tmpfile"

# WRONG — local masks exit code
local result=$(failing_cmd)

# RIGHT — split declaration and assignment
local result
result=$(failing_cmd)

# WRONG — grep returns 1 when no match, pipefail kills the pipeline
data | grep "pattern" | while read -r line; do ...

# RIGHT — handle grep's no-match exit code
data | { grep "pattern" || true; } | while read -r line; do ...
```

For loops, arrays, conditionals, and argument parsing patterns, see **`references/best-practices.md`**.

## PHASE 3: Static Analysis

After all edits, before staging:

```bash
# Run shellcheck — errors are mandatory fixes
shellcheck -S error "$script_path"

# Also run with warnings for advisory checks
shellcheck "$script_path"
```

**Shellcheck is not optional.** If shellcheck is not installed, note it in the worklog and flag for user attention.

### Key shellcheck codes to know

| Code | Issue | Severity |
|------|-------|----------|
| SC2086 | Unquoted variable | Error — almost always a bug |
| SC2046 | Unquoted command substitution | Error |
| SC2155 | `local var=$(cmd)` masks return code | Warning — error in errexit scripts |
| SC2164 | `cd` without `|| exit` | Warning — error in errexit scripts |
| SC2034 | Unused variable | Info |
| SC2029 | Expanding on client side in ssh | Warning |

### Syntax check (if shellcheck unavailable)

```bash
bash -n "$script_path"   # syntax check only, no execution
```

## PHASE 4: Testing

Shell tests vary by project. Check for:
- `bats` test files (`*.bats`)
- Test scripts (`test-*.sh`, `*_test.sh`)
- Makefile test targets
- CI workflow test steps

If no test framework exists and the change is non-trivial, suggest adding a test in the worklog.

## Final Report

- **Script**: path, shebang, strict modes
- **Constraints noted**: strict flags, existing traps, execution environment
- **Changes**: what was modified and why
- **Shellcheck**: pass/fail, codes addressed
- **Cleanup**: resources created and their cleanup mechanisms
