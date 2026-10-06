# Codex runtime

1. **Resolve context.** Set `WM_ROOT` to this installed plugin's root. Read [INDEX](../../../INDEX.md),
   [GLOSSARY](../../../GLOSSARY.md), and relevant [TOOLS](../../../TOOLS.md) rows. Resolve `wm:` at that root,
   `<skill>:` under `skills/<skill>/`, and `@` pointers relative to their containing file.
   A router's `sub:verify.md` shorthand names `commands/sub-verify.md`; use its existing
   `sub-<operation>.md` file when the literal command filename is absent. Resolve every
   `bin/...` invocation against `WM_ROOT`, retaining the checkout as the working directory.
   Run shell helpers with `CLAUDE_PLUGIN_ROOT="$WM_ROOT"` in their environment; Codex does
   not supply that Claude variable. References to `~/.claude/scripts` and loose Claude
   skills depend on this dotfiles repo's Claude stow setup. Check each needed dependency
   before using it; report a missing dependency rather than inventing its output.

2. **Translate tools.** Read a named agent's `agents/<name>.md` before delegating and include
   its instructions and checkout path in a Codex agent task. Use available Codex agent roles
   and inherit the session model; Claude's `haiku`, `sonnet`, and `opus` are source workflow
   tiers, not Codex model identifiers. Use Codex collaboration for independent jobs and
   explicitly await their completion. When collaboration is unavailable, run those jobs
   sequentially and disclose that the review was not independent. `Skill` means read the
   named skill; `Read`, `Bash`, `Edit`, and `Write` mean the available file, shell, and patch
   tools. Ask workflow questions with the available user-input tool, or in conversation
   when none exists. Existing user authorization controls approval gates.

3. **Run lifecycle checks explicitly.** This manifest registers skills only; Claude hook
   events and skill frontmatter hooks are not active in Codex. At route start, pipe a JSON
   object with the checkout's `cwd` into `bin/notes-locate.sh`, then `bin/notes-jj-init.sh`.
   Read the resulting notes context before selecting artifacts. Before changing spec or
   TODO metadata, run `bin/guard.sh` with `tool_input.file_path` and the full proposed
   `tool_input.content`; a JSON `decision: block` stops that edit even though the process
   exits successfully. Check `~/.claude/scripts/wm-open-questions.sh` and
   `~/.claude/scripts/wm-constraints.py`
   exist before relying on the guard's spec gate. After editing a TODO, run
   `bin/format-todo.py <file>` and `bin/budget-check.py <file>`. After thoughts edits, pipe
   the checkout `cwd` JSON into `bin/thoughts-archive.sh` and resolve its findings. At the
   verify or implementation gate, run `bin/spec-lint.py <notes-dir>` and resolve findings;
   an unfinished design may remain incomplete before that gate. At route end, pipe the checkout `cwd`
   JSON into `bin/notes-jj-commit.sh`. Confirm required helpers succeeded; hook wrappers
   can otherwise skip missing dependencies silently.

4. **Preserve the workflow across turns.** Follow the selected route's spec gate, review
   chain, and resume markers. For `auto`, execute the ledger loop in the active Codex
   session; Claude's `/goal` and Stop-hook continuation are unavailable. Create a Codex
   goal only when the user explicitly requests one. After compaction, reload the runtime,
   selected route, and notes context before resuming the next unfinished operation.
