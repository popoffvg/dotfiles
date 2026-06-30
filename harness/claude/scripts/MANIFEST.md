# Script Manifest

Reusable scripts managed by Claude. Always check here before writing a new script.

| Filename | Description |
|---|---|
| gen-test-fastq.sh | Generate synthetic paired-end <SAMPLE>_1/_2.sub.fastq.gz for import/sample-matcher tests |
| atuin-to-zsh-history.sh | Convert atuin history export to zsh extended_history format for suv import |
| pl-db-grep-kv.sh | Search RocksDB SST/WAL files for a string pattern in KV metadata |
| ccc-init-worktree.sh | Initialize and index ccc for all git repos in a worktree directory |
| ccc-mcp.sh | Launch `ccc mcp` (stdio MCP server); project resolved from $COCOINDEX_PROJECT env, else arg, else $PWD (validates it's an initialized ccc project) |
| lsp-references-smoke.py | Drive tengo-lsp over stdio and issue a textDocument/references request for end-to-end testing |
| build-zoom-html.py | Wrap a D2/Graphviz SVG into a zoomable HTML viewer (svg-pan-zoom CDN). Args: <svg-in> <html-out> <title> |
| cursor-agent-hang-capture.sh | Capture lsof+sample of a hung interactive cursor-agent (agent CLI) to find what startup is blocked on |
| strip-work-skill-prefix.sh | Strip the "work-" prefix from wm skill-name references in given files (Perl word-boundary, idempotent; avoids work-verify-gate/work-abandon/work-next-prompt) |
| openclaw-vault-rekey.sh | Re-key openclaw-infra ansible-vault when old password lost: reconstruct vault.yml from server's rendered telepi config.env over SSH, encrypt with new random password, update Keychain, print new password for GitHub secret. Arg: REPO_DIR (default PWD) |
| regroup-work-skills.sh | Regroup skills under category prefixes: renames global-store dir + recreates repo symlink (or moves real dir), fixes SKILL.md name frontmatter. Args: <repo-skills-dir> <old:new>... (new=__DELETE__ to drop) |
| rewrite-skill-refs.sh | Rewrite skill references in delimited forms only (`old`→`new`, skills/old/→skills/new/, @old→@new) so prose words are never touched. Args: <old:new>... -- <file>... |
| flow-reveal.mjs | Resolve the real source behind a workflow-pseudocode binding and open it in Zed. `reveal <file> <row> [--print]` opens the source for a notable-if ULID (via sibling *.bindings.json) or a .d.ts `@source` tag; `check <dir>` lints that every ULID/@source resolves to an existing path:line. Node, no deps. |
| flow-ulid.mjs | Print N ULIDs (Crockford base32, 26 chars) for tagging notable-if branches in workflow pseudocode. Args: [count] (default 1). Node, no deps. |
| rename-token.sh | Literal, case-explicit token replacement across files. Args: --pair OLD:NEW [--pair ...] FILE... — distinct tokens never collide (literal, not regex); idempotent; reports residual hits. |
| run-pl-backend-sso.sh | Run Platforma backend (pl) with SSO/OIDC auth against the Logto PoC tenant. Args: [--pl-dir DIR] [--root DIR] [--go-run] [--stub] [-- extra-pl-args]. FS primary storage (no minio); Logto values overridable via PL_SSO_* env. |
| tengo-lsp-install-local.sh | Install locally-built tengo-lsp release over VS Code bundled binary + ~/.local/bin (+ /usr/local/bin if writable); ad-hoc codesigns on arm64. Arg: [path-to-binary]. |
| commit-index-refresh.sh | Dump pl+platforma first-parent commits to per-commit JSON and (re)build the cocoindex commit-example index |
| commit-index-mcp.sh | Launch the commit-example search MCP server (search_commits tool over pl+platforma commit index) |
| commit-index-refresh-bg.sh | Fire-and-forget background launcher for commit-index refresh (used by SessionStart hook; idempotent, never blocks) |
| rehome-spec-skills.sh | One-time wm migration: de-symlink plan-* skills from the global store into the repo as real dirs renamed spec-*, then rename plan→spec inside (frontmatter, cross-refs, spec.md, .notes, prose nouns; keeps planning/planner). Arg: [REPO_ROOT]. Overlaps regroup-work-skills.sh + rewrite-skill-refs.sh — reuse those for future renames. |
| rename-plan-refs.sh | Safe identifier-level plan→spec rename in given files (plan-* skill names, plan.md/plan-verify.md, /work:plan-revise, claude-plan, _notes→.notes); no blanket prose rebrand. Idempotent. Args: <file>... |
| graphify_repo_ast_docs.py | Per-repo graphify extraction: AST(code)+semantic(docs only) via claude-cli; writes <repo>/graphify-out/graph.json |
| read-claude-local-subrepos.sh | SessionStart hook: find every git repo (incl. worktrees) under session cwd and emit each repo's CLAUDE.local.md to stdout as context. Prunes node_modules/.venv/vendor/target/dist/build/.cache. Reads cwd from stdin JSON, arg, or $PWD. |
| pty-capture-tui.py | Drive a TUI binary in a pty, snapshot the screen (built-in ANSI model) after each scripted keystroke. Headless, no controlling tty needed. |
| zellij-capture-tui.py | Drive a TUI in a zellij session, dump-screen per step. Note: headless dump-screen returns empty; prefer pty-capture-tui.py. |
