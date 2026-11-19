<!-- wm-workflow:start -->
## WM workflow

Read `<notes-dir>/AGENTS.md` before work on this spec. Read `<notes-dir>/RULES.md` for the human approval requirements.

1. Research the code with `/dive docs` when evidence is missing.
2. Run `/code new` to write the spec, resolve questions, and record decisions.
3. Stop until the human accepts the spec and approves every live ADR.
4. Run `/code todo` to write the TODO bodies.
5. Require `/code verify` to pass before implementation.
6. Run `/code impl TODO-N` for one TODO, or `/code auto` for the ledger.
7. Run the required tests and review checks before a TODO becomes done.
8. Run `/code squash` only when the human requests integration.

Command notation is runtime-specific. Use the runtime's WM aliases for these operations.

Only the human changes ADR approval status. Preserve the approval depth and checkout choice in the spec. Commit notes changes before the turn ends.
<!-- wm-workflow:end -->
