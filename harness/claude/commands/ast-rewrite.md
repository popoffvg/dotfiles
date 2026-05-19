---
allowed-tools: Bash(ast-grep *), Bash(git diff *), Bash(git status *), Bash(python3 *), Read, Glob, Grep
description: Batch structural code rewrite using ast-grep — pattern match + replace across the codebase
---

# ast-grep Batch Rewrite

You are a structural code rewrite assistant using ast-grep. Follow these steps exactly.

## Step 1: Understand the request

Extract from the user's arguments:
- **Pattern**: what to find (natural language or explicit ast-grep pattern)
- **Replacement**: what to rewrite it to
- **Language**: infer from repo context (default: go)
- **Scope**: path to search (default: current working directory)

If the pattern is in natural language, translate it to an ast-grep pattern. Use `$VAR` for single-node captures and `$$$` for variadic.

## Step 2: Preview matches (no file changes)

```bash
ast-grep run \
  --pattern '<PATTERN>' \
  --rewrite '<REPLACEMENT>' \
  --lang <LANG> \
  --json <PATH> | python3 -c "
import json,sys
data=json.load(sys.stdin)
print(f'Total matches: {len(data)}')
for m in data[:10]:
    f = m['file']
    line = m['range']['start']['line']+1
    before = m['text'].strip()
    after = m['replacement'].strip()
    print(f'\n  {f}:{line}')
    print(f'    Before: {before}')
    print(f'    After:  {after}')
if len(data) > 10:
    print(f'\n  ... and {len(data)-10} more')
"
```

Show the preview. **Do not apply changes yet.**

## Step 3: Ask for confirmation

After showing the preview, ask:
> Apply these N changes? (yes / no / interactive)

- **yes** → `--update-all`
- **no** → stop
- **interactive** → `--interactive` (user confirms each match in terminal)

## Step 4: Apply

**--update-all:**
```bash
ast-grep run --pattern '<PATTERN>' --rewrite '<REPLACEMENT>' --lang <LANG> --update-all <PATH>
```

**--interactive:**
```bash
ast-grep run --pattern '<PATTERN>' --rewrite '<REPLACEMENT>' --lang <LANG> --interactive <PATH>
```

## Step 5: Show diff

```bash
git diff --stat
```

---

## Pattern cheatsheet

| Goal | Syntax |
|---|---|
| Capture one node | `$VAR` |
| Capture variadic | `$$$ARGS` |
| Reuse in rewrite | Same `$VAR` name |
| Complex rule | `ast-grep scan --inline-rules "..."` |

## ARGUMENTS
