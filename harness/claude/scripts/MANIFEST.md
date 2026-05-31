# Script Manifest

Reusable scripts managed by Claude. Always check here before writing a new script.

| Filename | Description |
|---|---|
| atuin-to-zsh-history.sh | Convert atuin history export to zsh extended_history format for suv import |
| pl-db-grep-kv.sh | Search RocksDB SST/WAL files for a string pattern in KV metadata |
| ccc-init-worktree.sh | Initialize and index ccc for all git repos in a worktree directory |
| ccc-mcp.sh | Launch `ccc mcp` (stdio MCP server) with cwd pinned to a given project root |
| lsp-references-smoke.py | Drive tengo-lsp over stdio and issue a textDocument/references request for end-to-end testing |
| build-zoom-html.py | Wrap a D2/Graphviz SVG into a zoomable HTML viewer (svg-pan-zoom CDN). Args: <svg-in> <html-out> <title> |
| cursor-agent-hang-capture.sh | Capture lsof+sample of a hung interactive cursor-agent (agent CLI) to find what startup is blocked on |
| strip-work-skill-prefix.sh | Strip the "work-" prefix from work-manager skill-name references in given files (Perl word-boundary, idempotent; avoids work-verify-gate/work-abandon/work-next-prompt) |
