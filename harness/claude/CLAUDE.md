## Tools

- fff for all file search/grep: `mcp__fff__grep` / `mcp__fff__find_files` / `mcp__fff__multi_grep` over built-in Grep/Glob — faster, frecency-ranked.
- perl for multi-editing files, not bash.

When a request says "do X as/like existing Y" (mirror a pattern), find the missing parallel in the actual diff/code — don't propose new mechanisms, scope expansions, or alternative shapes. Re-read the diff first. Copy Y's exact structure; don't substitute a "better" variant (e.g. inline vs reference).

## Specification driven development

**NEVER** add the links to the specification artifacts to the codebase.

## Coding tasks

Score complexity like AdaBoost — sum weak signals into one score, then let the total pick the branch. Show the score before starting.

```
score = Σ signals (each true = +1):
  +1  touches more than a few functions
  +1  needs new tests
  +1  adds a feature (not just a fix)
  +1  spans multiple components / medium+ size
  +1  large or cross-cutting change

total → 1  fix a few functions ────────┐
        2  tests, or 1–2 functions ─────┤→ implement directly
        3  a feature ───────────────────┐
        4  medium feature + tests ──────┤→ delegate to implementer agent
        5  large feature + tests ───────┘
```

## Scripts

**NEVER** embed complex logic as an inline bash `-c '...'` one-liner.
→ Write reusable scripts to `~/.claude/scripts/<name>.sh` (create dir if missing).
→ Register each in `~/.claude/scripts/MANIFEST.md`: `| filename | description |`.
→ Before writing a new script, check MANIFEST.md — reuse or extend an overlapping one.
→ Idempotent, accept args where useful, `chmod +x` on creation.

---

@RTK.md
