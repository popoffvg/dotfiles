---
name: go-logger-analyzer
description: Structured analysis of JSON log files from Go loggers (zap, logrus, zerolog) — statistics, error patterns, field analysis. Skip for simple log viewing or grepping a known string.
argument-hint: [log-file-path]
---

## When to Use This Skill

**Use when:**
- Need statistics (error counts, logger distribution)
- Finding patterns in large log files
- Analyzing logs from unknown/complex systems
- User says "analyze logs" or "debug from logs"

**Skip when:**
- User says "show me the logs" - just use Read tool
- Looking for specific known error - use grep
- Log file is small (<100 lines) - just read it
- User wants latest entries - use `tail` command

---

Analyze JSON logs from **Go loggers** (zap, logrus, zerolog, etc.) used in Go projects. Follow this systematic workflow with prefix tree-powered analysis:

## 1. Load and Parse Logs

- If a log file path is provided via `$ARGUMENTS`, use it. Otherwise, ask the user for the path if not provided.
- **Use the Python analysis script** for initial statistics: `~/.claude/skills/go-logger-analyzer/analyze_logs.py`
  - Run: `python3 ~/.claude/skills/go-logger-analyzer/analyze_logs.py <log-file> --stats-only`
  - This gives you logger distribution, level distribution, error summary, and caller distribution
  - Use `--prefix-tree` for prefix tree-based field pattern discovery
- For detailed inspection or when Python is unavailable, read the log file using the Read tool
- Each line should be valid JSON with typical Go logger structure (usually includes: `level`, `ts/time`, `logger`, `msg`, `caller`, and custom fields)
- **Auto-detect logger format**: The script automatically detects zap, logrus, zerolog formats

## 2. Statistics Collection

Analyze the logs and provide a comprehensive statistics report:

### Logger Field Distribution
Count occurrences for each logger name/path. Example output:
```
Logger Distribution:
- ct.main: 150 entries
- ct.datactl.controller: 45 entries
- ct.datactl.reconciler: 32 entries
- ct.webhook: 12 entries
```

### Log Level Distribution
```
Level Distribution:
- info: 180 entries
- warn: 35 entries
- error: 24 entries
- debug: 0 entries
```

### Time Range
Report the first and last timestamp in the logs.

### Error Summary
If errors are present, summarize them with context.

## 3. Prefix Tree-Based Logger Field Analysis

For each unique logger name found (e.g., `ct.main`, `ct.datactl.controller`):

### 3.1 Traditional Search (Fallback)
1. **Map to source code**: Use gopls MCP to search for logger initialization patterns in Go code:
   - Search for `logger.Named("name")` or `logger.With(zap.String("logger", "name"))`
   - Search for variable assignments like `log := logger.Named("controller")`

### 3.2 Prefix Tree-Based Field Pattern Analysis (Primary Method)
2. **Use prefix tree analysis** for comprehensive logger field discovery:
   - Run: `python3 ~/.claude/skills/go-logger-analyzer/analyze_logs.py <log-file> --prefix-tree --logger <logger-name>`
   - **Default behavior**: Shows only top-level field paths (e.g., `request`, `response`, `error`)
   - **Interactive deep dive**: After seeing top-level fields, you can explore specific field subtrees
   - This builds a trie structure from log field patterns to find:
     - Common field prefixes and hierarchies (e.g., `request.id`, `request.method`, `response.status`)
     - Field value patterns and distributions
     - Nested field structures in custom fields
     - Field co-occurrence patterns
     - Logger-specific field signatures

3. **Deep Dive Options**:
   - `--tree-field <field>`: Explore specific field subtree (e.g., `--tree-field request`)
   - `--tree-deep`: Show complete prefix tree structure (all levels at once)
   - `--tree-pattern <pattern>`: Find fields matching prefix pattern
   - `--tree-threshold <n>`: Only show fields with >= n occurrences

Example default output (top-level only):
```
Prefix Tree Analysis for 'ct.main':
├── request (245 entries) - 5 unique values
├── response (245 entries) - 3 unique values  
├── error (25 entries) - 4 unique values
├── auth (15 entries) - 2 unique values
└── cache (8 entries) - 1 unique value

💡 To explore deeper:
   Use --tree-field <field_name> to explore specific field subtrees
   Use --tree-deep to show complete hierarchy at once
```

Example deep dive on specific field:
```
Field Subtree: request
├── id (245 entries) - UUID pattern
├── method (245 entries) - [GET:120, POST:80, PUT:45]
├── path (245 entries) - [/api/users:89, /api/orders:156]
└── headers (200 entries)
    └── user-agent (200 entries) - [curl:120, browser:80]
```

### 3.3 Field Pattern Insights
Show field relationships and patterns that help identify:
- Logger field signatures and naming conventions
- Common field hierarchies across different loggers
- Anomalous field patterns that might indicate issues
- Field usage trends over time

## 4. Identify Issue Location

**Critical**: Determine if the issue location is clear from the statistics:

- **If issue is NOT clear** (e.g., errors spread across many locations, no obvious pattern):
  - Count entries per location using `caller` field
  - Use the Python script: `python3 analyze_logs.py <log-file> --level error --limit 50`
  - Look for patterns in error messages, stacktraces, and caller locations
  - Identify the most frequent error locations and types

- **If issue is clear** (e.g., specific error, clear stacktrace, single failing component):
  - Skip detailed counting and filtering
  - Jump directly to investigating the specific error
  - Use gopls MCP tools to analyze the failing code
  - Focus on the root cause from the error context

## 5. Filter Interesting Logs

After showing statistics, **ask the user** what they want to focus on:
- Specific log levels (errors, warnings)
- Specific logger names
- Time ranges
- Specific message patterns
- Custom field values

Then present only the filtered logs in a readable format with:
- Timestamp
- Level
- Logger name
- Message
- Relevant fields (stacktrace, error, caller, etc.)

## Output Format

Use **clear sections** with markdown formatting:
- Use **bold** for section headers and key metrics
- Use code blocks for log samples and mappings
- Use tables when comparing multiple loggers
- Keep output concise - show summaries first, details on request

## Tips

- **Use the Python script** for efficient analysis: `python3 ~/.claude/skills/go-logger-analyzer/analyze_logs.py <log-file>`
  - `--stats-only`: Show only statistics
  - `--level error`: Filter by log level
  - `--logger <name>`: Filter by logger name
  - `--message <pattern>`: Filter by message pattern
  - `--limit N`: Limit output entries (default: 20)
  - `--prefix-tree`: Perform prefix tree-based field analysis (top-level summary by default)
  - `--tree-deep`: Show detailed prefix tree structure (all levels)
  - `--tree-field <field>`: Analyze specific field subtree
  - `--tree-pattern <pattern>`: Find fields matching prefix pattern
  - `--tree-threshold <n>`: Minimum occurrences for field display
- If logs are large (>1000 lines), use the Python script or process them incrementally
- Focus on errors and warnings first unless user specifies otherwise
- **Prefix Tree Analysis**: Provides deep insights into field patterns, hierarchies, and relationships within log data
- **Interactive exploration**: Start with top-level summary, then dive deeper into specific fields of interest
- Field patterns help identify application structure, API endpoints, error types, and performance characteristics
- If field names don't match standard patterns, prefix tree analysis can still reveal the underlying structure
- Always validate that each line is valid JSON before parsing
- **Multi-format support**: Automatically detects zap, logrus, zerolog, and custom JSON formats

## Example Interaction

**User**: "analyze logs from /tmp/app.log"

**You**:
1. Read the log file
2. Show statistics: logger distribution, level distribution, time range, top messages
3. Run prefix tree analysis: `python3 ~/.claude/skills/go-logger-analyzer/analyze_logs.py /tmp/app.log --prefix-tree`
4. Show top-level field summary with guidance for deeper exploration
5. Ask: "What would you like to focus on? (e.g., errors only, specific logger, explore 'request' field subtree)"

**User**: "explore the request field"

**You**:
1. Run: `python3 ~/.claude/skills/go-logger-analyzer/analyze_logs.py /tmp/app.log --prefix-tree --tree-field request`
2. Show detailed field subtree for request with all nested fields and values
3. Provide insights about request patterns and anomalies

## Autoresearch rules

**Eval checklist:**
1. Did the analysis produce quantitative statistics (error counts, logger distribution) — not just prose?
2. Were error patterns grouped by type (not listed individually)?
3. Did the agent skip this skill for simple log viewing or known-string grep?
4. Was the correct log format detected (zap/logrus/zerolog) before parsing?

**Test inputs:**
- "Analyze 10K-line JSON log from a Go service with mixed zap and zerolog output"
- "Find error patterns in production logs after a deploy"
- "Show me the logs" (should skip skill, use Read tool)

**Can change:** analysis steps, statistics format, pattern grouping strategy, field analysis depth
**Cannot change:** skip-when criteria (simple viewing, small files, known grep), JSON log focus
**Min sessions before eval:** 5
**Runs per experiment:** 3