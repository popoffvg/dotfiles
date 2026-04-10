---
name: todo-fix
description: >
  Find TODO, FIXME, HACK, XXX comments in git changes or untracked files that need immediate attention.
  Use when reviewing code before commit, during PR prep, or to catch leftover debug markers.
---

# todo-fix

Scan for actionable TODO/FIXME/HACK/XXX comments that should be resolved before committing.

## Scope

There are two scopes to check. Always run both unless the user specifies one.

### 1. Git changes (staged + unstaged diffs)

Find markers introduced in current changes (new lines only, not existing code):

```bash
git diff -U0 HEAD | grep -n '^\+' | grep -iE '\b(TODO|FIXME|HACK|XXX)\b' || true
git diff -U0 --cached | grep -n '^\+' | grep -iE '\b(TODO|FIXME|HACK|XXX)\b' || true
```

To see which files they belong to, use the full diff with filenames:

```bash
git diff HEAD --name-only
git diff --cached --name-only
```

Then for each changed file, search only the changed hunks.

### 2. Untracked files

Files not yet in git — these often contain scratch code with leftover markers:

```bash
git ls-files --others --exclude-standard | while read f; do
  grep -nHiE '\b(TODO|FIXME|HACK|XXX)\b' "$f" 2>/dev/null || true
done
```

## Output format

Present results as a table:

| File | Line | Marker | Text |
|------|------|--------|------|
| `src/handler.go` | 42 | TODO | handle timeout case |
| `lib/util.ts` | 17 | FIXME | this breaks on empty input |

## Action

After listing all findings:

1. **Summarize**: "Found N markers in M files (K in diffs, J in untracked)"
2. **Categorize** by severity:
   - 🔴 **FIXME** — bugs, must fix before commit
   - 🟡 **TODO/HACK/XXX** — tech debt, review before commit
3. **Ask the user** which ones to resolve now
4. For each selected marker, propose a fix or ask for guidance

## Notes

- Ignore markers inside comments that reference external issue trackers (e.g., `TODO(JIRA-123)`) — those are intentional.
- If no markers found, report clean status: "No TODO/FIXME markers in current changes."
- If not inside a git repo, fall back to scanning all files in cwd recursively:
  ```bash
  grep -rnHiE '\b(TODO|FIXME|HACK|XXX)\b' . --include='*.go' --include='*.ts' --include='*.js' --include='*.py' --include='*.rs' --include='*.rb' --include='*.java' --include='*.c' --include='*.cpp' --include='*.h' 2>/dev/null || true
  ```

## Autoresearch rules

**Eval checklist:**
1. Did the scan cover both scopes: git changes and untracked files?
2. Were only newly introduced markers reported for diffs (not legacy TODOs)?
3. Was the output presented in the required table format with file, line, marker, text?
4. Did severity categorization match marker type (FIXME=red, TODO/HACK/XXX=yellow)?

**Test inputs:**
- "Review staged+unstaged changes before commit"
- "Scan repo with multiple untracked scratch files"
- "Run in non-git directory" (fallback recursive scan)

**Can change:** scan command strategy, deduplication, output formatting details, summary wording
**Cannot change:** two-scope coverage rule, severity mapping, user-approval before resolving markers
**Min sessions before eval:** 5
**Runs per experiment:** 3
