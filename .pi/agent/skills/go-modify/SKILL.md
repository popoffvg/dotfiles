---
name: go-modify
description: Gopls-validated Go code changes — renames, refactoring, multi-file coordinated changes with reference tracking. Includes pre-edit analysis of file constraints, resource lifecycle checks, and static analysis. Use for any non-trivial Go file edits.
---

# Go Code Modification Skill

Modify Go code using gopls MCP tools for analysis and validation.

## When to Use This Skill

**Use when:**
- Renaming symbols across multiple files
- Refactoring requiring reference tracking
- Changes needing gopls validation (imports, types)
- Multi-file coordinated changes
- Any change to files with build tags, code generation, or complex error patterns

**Skip when:**
- Simple single-file edit with obvious change
- Adding a new function (no references to update)
- Fixing typos or formatting
- User says "just fix it" for small changes

## Prerequisites

- For complex changes: use `go-understanding` skill first
- Ensure gopls MCP server is running

## PHASE 1: Pre-Edit Analysis

Before making any changes, read the ENTIRE target file and note:

### File-level constraints checklist
- [ ] **Build tags**: `//go:build integration`, `//go:build !windows`, etc. — your code must respect these
- [ ] **Code generation markers**: `// Code generated ... DO NOT EDIT` — never edit generated files, edit the generator or template instead
- [ ] **Error handling pattern**: does the package use `fmt.Errorf` wrapping, sentinel errors, custom error types? Match it.
- [ ] **Context propagation**: does the package thread `context.Context`? New functions must follow the same pattern.
- [ ] **Linter directives**: `//nolint:`, `//lint:ignore` — understand why they exist before removing or adding

### Resource lifecycle checklist
If your change creates resources, verify cleanup exists:
- `os.CreateTemp` / `os.MkdirTemp` → `defer os.Remove(name)` / `defer os.RemoveAll(dir)`
- `os.Open` / `os.Create` → `defer f.Close()`
- `sync.WaitGroup` → ensure `Add`/`Done`/`Wait` are balanced
- goroutines → ensure they have a shutdown path (context cancellation, done channel)
- `net.Listener` / `net.Conn` → `defer listener.Close()`
- `*sql.Rows` → `defer rows.Close()`

### Check project rules
- `CLAUDE.md` and `.claude/rules/` if they exist
- `golangci-lint` config (`.golangci.yml`) for enabled linters

## PHASE 2: Planning

1. Review file-level constraints from Phase 1
2. Identify symbols that need modification
3. Plan the change sequence — which files, which order

## Execution Rule

**Never pause mid-task to ask "shall I proceed?" or similar.** When the intent is clear, complete all phases autonomously. Only ask if a destructive ambiguity is discovered (e.g., two symbols with identical names in different packages).

## PHASE 3: Implementation

### Step 3.1: Find All References
Before modifying any symbol:
```
mcp gopls go_symbol_references: file="/path/to/file.go" symbol="SymbolName"
```

### Step 3.2: Make Edits
Use Edit tool to modify code. Update all references found in step 3.1.

### Step 3.3: Validate with Diagnostics
After EVERY edit:
```
mcp gopls go_diagnostics: files=["/path/to/edited/file.go"]
```

### Step 3.4: Fix Errors
If diagnostics report errors:
- Apply suggested fixes from diagnostics output
- Re-run diagnostics until clean
- Ignore 'hint' or 'info' level if not relevant

## PHASE 4: Static Analysis

After all edits are complete, before staging:

```bash
# Compilation check
go build ./...

# Vet — catches common mistakes (printf args, unreachable code, etc.)
go vet ./...

# Race detector on tests if concurrency is involved
go test -race -count=1 ./affected/package/...
```

Fix all errors. `go vet` findings are not optional — they indicate real bugs.

If the project has `golangci-lint`:
```bash
golangci-lint run ./affected/package/...
```

## Required Tools

- `mcp gopls go_symbol_references` — Find all symbol references
- `mcp gopls go_diagnostics` — Validate changes
- Edit tool — Make code changes

## Final Report

Report:
- **Changed**: Modified files and symbols
- **Constraints noted**: Build tags, error patterns followed
- **Diagnostics**: Issues found and resolved
- **Static analysis**: `go vet` / linter results
- **Impact**: Affected code paths (from references check)

## Autoresearch rules

**Eval checklist:**
1. Did the agent read the full file before making any edit (no blind edits)?
2. Did `go build ./...` pass after all edits were complete?
3. Were zero tool failures (failed edit/write calls) during the modification?
4. Were all references to renamed/moved symbols updated across files (zero dangling references)?
5. Was gopls used for reference tracking on multi-file changes?

**Test inputs:**
- "Rename function ProcessOrder to HandleOrder across 3 files"
- "Add error wrapping to all return statements in handler.go"
- "Extract method from 50-line function into a new file"

**Can change:** pre-edit checklist, gopls validation steps, error recovery instructions, file constraint analysis
**Cannot change:** gopls requirement for multi-file changes, read-before-edit rule, build verification step
**Min sessions before eval:** 5
**Runs per experiment:** 3
