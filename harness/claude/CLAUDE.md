# Rules

@rules/language.md
@rules/evidence.md
@rules/code.md
@rules/do-not-do.md
@rules/tools.md
@rules/long-commands.md
@rules/scripts.md
@rules/open-file.md

# Push

- Before every push, run the repo's own linter over the changed files, with the PR base as the diff base. Use the version the repo pins (for example `go tool golangci-lint`, `npx`, `mise run lint`), not a global binary.
- Before every push, run the tests of the changed packages. After a merge-conflict resolution, run them before the push, not after CI fails.
- If the local linter or tests cannot run, fix the call or tell the user. Do not push and leave lint to CI.

# Reports

Applies to slides, reports, and docs that a person reads to decide.

- Every claim and number MUST trace to a source: a `file:line` in code, a config value, command output, or fetched data. Cite the source next to the claim.
- If no source supports a number, label it "assumption" and state its basis. Do not invent input values, rates, or estimates.
- Take a runtime value from the config that applies at run time (for example CloudFormation), not from a chart default or a doc.
- Derive a resource estimate from the source code and the input format, not from docs or commit history. Check the result against the real capacity (for example node RAM) and explain any mismatch.
