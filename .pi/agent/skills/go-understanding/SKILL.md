---
name: go-understanding
description: Comprehensive analysis of unfamiliar Go packages — structure, public API, dependencies, coding patterns. Use when exploring a new package or preparing for complex refactoring.
argument-hint: [package-path]
---

# Go Code Understanding Skill

Systematic workflow for understanding Go codebases before making modifications.

## When to Use This Skill

**Use when:**
- Starting work on a completely new/unfamiliar package
- Need full structural analysis (types, interfaces, dependencies)
- Preparing for complex refactoring across package
- Understanding public API before integration

**Skip when:**
- Reading a single file you already know
- Making small changes to familiar code
- Just checking a function implementation
- User asks "show me X" - just use Read tool directly

## Core Understanding Workflow

### Step 1: Package Selection and Documentation

Always choose the specific package you want to work with, then:

1. **Read package documentation in order:**
   - `doc.go` - Package documentation and examples
   - `index.out` - Generated documentation index
   - `README.md` - Project-specific information
   - Package-level comments

2. **Report documentation usefulness:**
   - If you found useful information in `index.out` or `doc.go`, report it
   - Note any missing or outdated documentation

### Step 2: Structural Analysis

Use gopls MCP tools for comprehensive analysis:

```bash
# Understand workspace structure
mcp__gopls__go_workspace

# Find relevant symbols and patterns
mcp__gopls__go_search "pattern"

# Get detailed file context
mcp__gopls__go_file_context "/path/to/file.go"

# Understand package API
mcp__gopls__go_package_api "package/path"
```

### Step 3: Code Context Gathering

1. **Read target files** with focus on:
   - Public interfaces and types
   - Key functions and methods
   - Error handling patterns
   - Dependencies and imports

2. **Read tests** to understand:
   - Expected behavior
   - Usage patterns
   - Edge cases
   - Test helpers and fixtures

### Step 4: Synthesis

Summarize your findings:
- **Package purpose**: What the code does
- **Key components**: Main types, functions, interfaces
- **Dependencies**: External and internal dependencies
- **Patterns**: Coding conventions, error handling, testing patterns
- **Modification impact**: What changes might affect

## Integration with Other Skills

This understanding phase should be used before:
- `go-modify` - For code modifications
- `go-test-debug` - For test debugging
- `go-debug` - For debugging workflows

## Quick Reference

### Documentation Files Priority
1. `doc.go` - Always read first
2. `index.out` - Generated docs
3. `README.md` - Project context
4. Package comments

### Analysis Tools Priority
1. `go_workspace` - Structure overview
2. `go_search` - Find symbols
3. `go_file_context` - Detailed analysis
4. `go_package_api` - Interface understanding

### Reporting Format
- **Purpose**: One-sentence package description
- **Components**: Key types and functions (3-5 items)
- **Dependencies**: Critical dependencies only
- **Patterns**: Notable conventions found
- **Impact**: Potential modification risks

## Tips

- Use semantic search for finding related code patterns
- Check `.claude/rules/go-coding.md` for project-specific conventions
- Always validate understanding with gopls diagnostics
- Focus on public API first, implementation details second
- Document any assumptions made during understanding process
