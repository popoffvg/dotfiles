# Script Manifest

Reusable scripts managed by Claude. Always check here before writing a new script.

| Filename | Description |
| repos-survey.sh | Read-only survey of every git repo under a root: branch, dirty-file count, upstream, ahead/behind, HEAD. Args: `<root-dir> [out.tsv]`. Run before any bulk update. |
| repos-update.sh | Fetch + **fast-forward-only** pull every clean repo under a root. Skips dirty trees, missing upstreams, and repos with local commits ahead; never merges or rebases. Forces HTTPS-over-SSH so gh's token authenticates. Args: `<root-dir> [out.tsv]` → per-repo status (UPDATED/UP_TO_DATE/SKIP_DIRTY/…) + new-commit counts. Needs sandbox off (SSH is intercepted). |
| collect-range-commits.sh | Per-repo commit logs for the exact `old..new` ranges recorded by repos-update.sh — the input for incremental "what arrived since last audit" analysis. Args: `<root-dir> <update.tsv> <out-dir>`. |
| conformance-diff.sh | Diff two block-conformance-scan.sh TSVs: per-column totals before→after with deltas, plus per-block changed cells and NEW BLOCK lines. Args: `<before.tsv> <after.tsv>`. |
| block-conformance-scan.sh | Inventory structural conformance of Platforma blocks under a root dir (facade, block.meta, model API version V1/V3, turbo/pnpm/changeset config, root scripts, eslint, tests, CI, hygiene files). Emits one TSV row per block. Args: `<blocks-root> [out.tsv]`. |
| collect-fix-commits.sh | Sweep every git repo under a root dir for bug-fix-looking commits since a date (keyword grep over subject+body). Writes `<out-dir>/<repo>.log` per repo and prints per-repo counts. Args: `<root-dir> <since-date> [out-dir]`. Used for cross-repo bug retrospectives. |
|---|---|
| doctor-transcript-scan.sh | Aggregate /doctor signals from the N most-recent Claude Code transcripts (default 50): MCP tool calls, skill dispatches, slash commands, per-hook timings + timeouts, and tool denials by kind. Arg: [N] |
| gen-test-fastq.sh | Generate synthetic paired-end <SAMPLE>_1/_2.sub.fastq.gz for import/sample-matcher tests |
| atuin-to-zsh-history.sh | Convert atuin history export to zsh extended_history format for suv import |
| pl-db-grep-kv.sh | Search RocksDB SST/WAL files for a string pattern in KV metadata |
| lsp-references-smoke.py | Drive tengo-lsp over stdio and issue a textDocument/references request for end-to-end testing |
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
| rehome-spec-skills.sh | One-time wm migration: de-symlink plan-* skills from the global store into the repo as real dirs renamed spec-*, then rename plan→spec inside (frontmatter, cross-refs, spec.md, .notes, prose nouns; keeps planning/planner). Arg: [REPO_ROOT]. Overlaps regroup-work-skills.sh + rewrite-skill-refs.sh — reuse those for future renames. |
| rename-plan-refs.sh | Safe identifier-level plan→spec rename in given files (plan-* skill names, plan.md/plan-verify.md, /work:plan-revise, claude-plan, _notes→.notes); no blanket prose rebrand. Idempotent. Args: <file>... |
| graphify_repo_ast_docs.py | Per-repo graphify extraction: AST(code)+semantic(docs only) via claude-cli; writes <repo>/graphify-out/graph.json |
| read-claude-local-subrepos.sh | SessionStart hook: find every git repo (incl. worktrees) under session cwd and emit each repo's CLAUDE.local.md to stdout as context. Prunes node_modules/.venv/vendor/target/dist/build/.cache. Reads cwd from stdin JSON, arg, or $PWD. |
| pty-capture-tui.py | Drive a TUI binary in a pty, snapshot the screen (built-in ANSI model) after each scripted keystroke. Headless, no controlling tty needed. |
| zellij-capture-tui.py | Drive a TUI in a zellij session, dump-screen per step. Note: headless dump-screen returns empty; prefer pty-capture-tui.py. |
| pl-mcp.sh | Call a Platforma desktop MCP tool: pl-mcp.sh <tool> [json-args], PL_MCP_URL env |
| zk-classify.py | Zettelkasten migration Phase 0: classify a vault's .md files into target layers (00-inbox/10-sources/20-notes/30-maps/40-journal/_attic) by pure heuristics. Dry-run — writes reviewable migration_plan.csv, moves nothing. Args: <vault-dir> [out.csv] |
| zk-migrate.py | Zettelkasten migration P1: move files per migration_plan.csv + normalize frontmatter (id/type/status), collision-safe (dedup identical, hash-suffix differing), undo-logged to .ledger/moves.jsonl. Dry-run default; --apply. Reverse with --undo-from. |
| zk-link-backfill.py | Zettelkasten P4: insert [[wikilinks]] from a title+alias index (0 tokens). Conservative: exact-phrase, skips code/headings/existing links, stoplist + domain/attrib exclusions. Dry-run default; --apply. |
| zk-dedup-sources.py | Dedup 10-sources literature notes that are the SAME article: group by source url, cluster within by identical-body OR core-title (strips ` - author`/`(domain)`/hash); distinct articles sharing a url are reported, never merged. Folds dropped names into survivor aliases. Dry-run default; --apply. |
| zk-rename-kebab.py | Align note filenames to their kebab `id` (filename==id). Folds old filename+title into aliases so [[links]] resolve. Ordering-safe two-phase rename (temp then final — never clobbers a queued file). Collision-suffixes duplicate ids. Dry-run default; --apply. |
| zk-lint-links.py | Find/remove stale [[wikilinks]] the way Obsidian resolves (basename+id+aliases — alias-aware, unlike a filename-only check). Removal unwraps to prose ([[X\|Y]]->Y, [[X]]->X); skips code fences. Dry-run default; --apply. |
| zcore-tags.mjs | Extract + tally tags across an Obsidian vault (frontmatter + inline). --json for downstream tooling. |
| zcore-backfill-topic.mjs | Add curated `topic` frontmatter to Z-Core notes derived from existing tags. Dry-run by default; --apply writes. |
| openclaw-verify-fetch.sh | Verify the deployed openclaw blogs extension fetches URLs: runs Fetcher.fetchCached over ssh with the live telepi service env, prints title/cached/chars/body-excerpt per URL. Args: <url>... |
