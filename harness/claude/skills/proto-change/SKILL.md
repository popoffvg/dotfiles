---
name: proto-change
description: buf-validated Protocol Buffers authoring — write or modify .proto files with pre-edit analysis of wire-compat constraints, style conventions, and coordinated codegen + downstream consumer updates. Use for any non-trivial .proto edit (new message/field/rpc, type change, deprecation).
---

# Proto Authoring Skill

Write and modify `.proto` files as a structured workflow — analogous to `go-modify`. Treat the `.proto` as the source of truth and generated Go/TS bindings as derived artifacts that must stay in lock-step.

## When to Use This Skill

**Use when:**
- Adding or removing a message, field, enum value, or RPC
- Changing a field's type, label, or number
- Splitting or merging messages
- Introducing a new `.proto` file or package
- Any change that will regenerate `*.pb.go` / `*_grpc.pb.go` / generated TS types

**Skip when:**
- Comment-only edits
- Formatting / import ordering with no semantic change

## Prerequisites

- `buf`, `protoc`, or the project's codegen task available (check `buf.gen.yaml`, `Makefile`, `mise.toml`, `package.json`)
- Generated output directories are writable and **not** in `.gitignore` if the repo commits generated code

## PHASE 1: Pre-Edit Analysis

Read the **entire** target `.proto` file (and its `import` chain one level deep) before any edit.

### File-level constraints checklist
- [ ] **`syntax`** — proto2 vs proto3 changes defaults (optional/required, zero values)
- [ ] **`package`** + `option go_package` / `option java_package` — generated path is derived from these
- [ ] **Existing field numbers** — note the highest number; reserved ranges; never reuse a removed field number or name (use `reserved`)
- [ ] **Naming conventions** in the file: `snake_case` field names, `PascalCase` messages, `SCREAMING_SNAKE_CASE` enum values, enum zero value suffix (`_UNSPECIFIED`)
- [ ] **Wire-compat history** — if this proto is on a network or persisted, deletions/renumberings are breaking. Mark removed fields with `reserved <num>;` and `reserved "name";`
- [ ] **Custom options / annotations** — `google.api.http`, `validate.rules`, `buf.validate` — follow the existing pattern
- [ ] **Streaming RPCs** — note `stream` on either side; clients regenerate differently
- [ ] **Well-known types** — prefer `google.protobuf.Timestamp`, `Duration`, `Empty`, `Struct` over reinventing

### Codegen surface checklist
Identify every consumer **before** editing:
- Generator config (`buf.gen.yaml` plugins → output dirs)
- Go package(s) importing the generated `*.pb.go`
- TS package(s) importing the generated client (often `@<scope>/<api>-ts`)
- Any non-Go/TS consumer (Python, Java)

## PHASE 2: Planning

1. Classify the edit:
   - **Additive** (new field with new number, new optional message, new RPC) → wire-compatible
   - **Renaming** (field/message name only, number unchanged) → wire-compatible but breaks source consumers
   - **Breaking** (type change, number change, removal, label change) → requires migration plan
2. For breaking changes: write the migration in `.notes/` before editing (new field + dual-write + flip + remove).
3. Pick field numbers explicitly. Use 1–15 for hot fields (1-byte tag), 16+ for cold.
4. List the exact codegen command(s) to run after the edit.

## Execution Rule

**Never `rm -rf` a generated directory.** Re-run codegen in place. If output looks stale, delete only files the generator owns and re-emit. Generated files belong in the **same commit** as the `.proto` change.

**Never pause mid-task** to ask "shall I proceed?" once intent is clear. Only stop on destructive ambiguity (e.g., the field number you want is in a `reserved` range).

## PHASE 3: Implementation

### Step 3.1: Edit the `.proto`
Use Edit tool. Match existing style. For removals, add `reserved` entries in the same edit.

### Step 3.2: Lint
```bash
buf lint            # or: buf lint <module>
buf breaking --against '.git#branch=main'   # if the project tracks wire compat
```
Fix all findings. `buf breaking` failures are not optional unless the migration plan from Phase 2 explicitly accepts the break.

### Step 3.3: Regenerate
Run the project's codegen task (look it up — do not guess):
```bash
buf generate                    # most projects
mise run gen                    # if a mise task exists
# or the Makefile target the repo defines
```
Verify the generator wrote new files. If output is empty, the plugin config is wrong — fix `buf.gen.yaml`, do not delete the output dir.

### Step 3.4: Update Consumers
For each downstream Go/TS package identified in Phase 1:
- Apply the same naming change (rename, new field accessor)
- For new optional fields: existing call sites compile unchanged
- For removed/renamed fields: every reference must be updated in this same change

Use `mcp gopls go_symbol_references` (Go) and `ast-grep` / `ccc` (TS, polyglot) to find call sites.

### Step 3.5: Build & Test
```bash
go build ./...
go test ./<affected>/...
pnpm -r build      # or the project's TS build
```

## PHASE 4: Commit Hygiene

One commit contains:
1. The `.proto` change
2. All regenerated files
3. All consumer updates required to compile

Never split `.proto` from its generated artifacts across commits — intermediate states won't build.

## Required Tools

- `buf` (lint + breaking + generate) or project codegen task
- Edit tool for the `.proto`
- `mcp gopls go_symbol_references` for Go consumers
- `ast-grep` / `ccc` for cross-language reference tracking

## Final Report

- **Edit class**: additive / renaming / breaking
- **Field numbers used / reserved**
- **`buf lint` and `buf breaking` results**
- **Generated files**: list paths
- **Consumers updated**: files + symbols
- **Build/test**: results per package

## Autoresearch rules

**Eval checklist:**
1. Did the agent read the full `.proto` and its imports before editing?
2. Was `buf lint` (or equivalent) run and clean?
3. Was `buf breaking` run for projects with wire-compat history?
4. Were generated files committed alongside the `.proto`?
5. Were zero `rm -rf` operations performed on generated dirs?
6. Did all downstream Go/TS consumers build after the change?

**Test inputs:**
- "Add a `repeated string tags = 4` field to `Tree` message"
- "Rename `GetNode` RPC to `FetchNode` across api.proto and TS client"
- "Deprecate `legacy_id` field and add `id` as bytes"

**Can change:** pre-edit checklist, lint commands, consumer-discovery steps, generator invocation
**Cannot change:** no-`rm -rf` rule, same-commit rule for proto + generated, lint-before-generate order
**Min sessions before eval:** 5
**Runs per experiment:** 3
