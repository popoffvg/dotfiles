# Rules

@rules/language.md
@rules/evidence.md
@rules/code.md
@rules/do-not-do.md
@rules/tools.md
@rules/long-commands.md
@rules/scripts.md
@rules/open-file.md

# Reports

Applies to slides, reports, and docs that a person reads to decide.

- Every claim and number MUST trace to a source: a `file:line` in code, a config value, command output, or fetched data. Cite the source next to the claim.
- If no source supports a number, label it "assumption" and state its basis. Do not invent input values, rates, or estimates.
- Take a runtime value from the config that applies at run time (for example CloudFormation), not from a chart default or a doc.
- Derive a resource estimate from the source code and the input format, not from docs or commit history. Check the result against the real capacity (for example node RAM) and explain any mismatch.
