#!/usr/bin/env bash
set -eo pipefail

\# FFF MCP Server installer
\# Usage: curl -fsSL https://raw.githubusercontent.com/dmtrKovalenko/fff.nvim/main/install-mcp.sh \| bash

REPO="dmtrKovalenko/fff.nvim"
BINARY\_NAME="fff-mcp"
INSTALL\_DIR="${FFF\_MCP\_INSTALL\_DIR:-$HOME/.local/bin}"

info() { printf '\\033\[1;34m%s\\033\[0m\\n' "$\*"; }\
success() { printf '\\033\[1;38;5;208m%s\\033\[0m\\n' "$\*"; }\
warn() { printf '\\033\[1;33m%s\\033\[0m\\n' "$\*"; }\
error() { printf '\\033\[1;31mError: %s\\033\[0m\\n' "$\*" >&2; exit 1; }\
\
\# Print JSON with syntax highlighting via jq if available, plain otherwise\
print\_json() {\
 if command -v jq &>/dev/null; then\
 echo "$1" \| jq .\
 else\
 echo "$1"\
 fi\
}\
\
detect\_platform() {\
 local os arch target\
\
 os="$(uname -s)"\
 arch="$(uname -m)"\
\
 case "$os" in\
 Linux)\
 # Prefer musl (static) for maximum compatibility\
 case "$arch" in\
 x86\_64) target="x86\_64-unknown-linux-musl" ;;\
 aarch64\|arm64) target="aarch64-unknown-linux-musl" ;;\
 \*) error "Unsupported architecture: $arch" ;;\
 esac\
 ;;\
 Darwin)\
 case "$arch" in\
 x86\_64) target="x86\_64-apple-darwin" ;;\
 aarch64\|arm64) target="aarch64-apple-darwin" ;;\
 \*) error "Unsupported architecture: $arch" ;;\
 esac\
 ;;\
 MINGW\*\|MSYS\*\|CYGWIN\*)\
 case "$arch" in\
 x86\_64) target="x86\_64-pc-windows-msvc" ;;\
 aarch64\|arm64) target="aarch64-pc-windows-msvc" ;;\
 \*) error "Unsupported architecture: $arch" ;;\
 esac\
 ;;\
 \*) error "Unsupported OS: $os" ;;\
 esac\
\
 echo "$target"\
}\
\
get\_latest\_release\_tag() {\
 local target="$1"\
 local releases\_json\
 releases\_json=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases") \\
 \|\| error "Failed to fetch releases from https://github.com/${REPO}/releases"\
\
 # Find the first release that contains an fff-mcp binary for our platform\
 local tag\
 tag=$(echo "$releases\_json" \\
 \| grep -oE '"(tag\_name\|name)": \*"\[^"\]\*"' \\
 \| awk -v target="fff-mcp-${target}" '\
 /"tag\_name":/ { gsub(/.\*": \*"\|"/, ""); current\_tag = $0; next }\
 /"name":/ && index($0, target) { print current\_tag; exit }\
 ')\
\
 if \[ -z "$tag" \]; then\
 error "No release found containing fff-mcp binaries for ${target}. The MCP build may not have been released yet."\
 fi\
 echo "$tag"\
}\
\
download\_binary() {\
 local target="$1"\
 local tag="$2"\
 local ext=""\
\
 case "$target" in\
 \*windows\*) ext=".exe" ;;\
 esac\
\
 local filename="${BINARY\_NAME}-${target}${ext}"\
 local url="https://github.com/${REPO}/releases/download/${tag}/${filename}"\
 local checksum\_url="${url}.sha256"\
\
 info "Downloading ${filename} from release ${tag}..."\
\
 local tmp\_dir\
 tmp\_dir="$(mktemp -d)"\
 trap 'rm -rf "$tmp\_dir"' EXIT\
\
 if ! curl -fsSL -o "${tmp\_dir}/${filename}" "$url" 2>/dev/null; then\
 echo "" >&2\
 printf '\\033\[1;31mError: Failed to download binary for your platform.\\033\[0m\\n' >&2\
 echo "" >&2\
 echo " URL: ${url}" >&2\
 echo " Release: ${tag}" >&2\
 echo " Platform: ${target}" >&2\
 echo "" >&2\
 echo "This likely means the MCP binary hasn't been built for this release yet." >&2\
 echo "Check available releases at: https://github.com/${REPO}/releases" >&2\
 exit 1\
 fi\
\
 # Verify checksum if sha256sum is available\
 if command -v sha256sum &>/dev/null; then\
 if curl -fsSL -o "${tmp\_dir}/${filename}.sha256" "$checksum\_url" 2>/dev/null; then\
 info "Verifying checksum..."\
 (cd "$tmp\_dir" && sha256sum -c "${filename}.sha256") \\
 \|\| error "Checksum verification failed!"\
 else\
 warn "Checksum file not available, skipping verification."\
 fi\
 fi\
\
 # Install\
 mkdir -p "$INSTALL\_DIR"\
 mv "${tmp\_dir}/${filename}" "${INSTALL\_DIR}/${BINARY\_NAME}${ext}"\
 chmod +x "${INSTALL\_DIR}/${BINARY\_NAME}${ext}"\
\
 if \[ "$IS\_UPDATE" != true \]; then\
 success "Installed ${BINARY\_NAME} to ${INSTALL\_DIR}/${BINARY\_NAME}${ext}"\
 fi\
}\
\
check\_path() {\
 case ":$PATH:" in\
 \*":${INSTALL\_DIR}:"\*) return 0 ;;\
 esac\
\
 warn "${INSTALL\_DIR} is not in your PATH."\
 echo ""\
 echo "Add it to your shell profile:"\
 echo ""\
\
 local shell\_name\
 shell\_name="$(basename "${SHELL:-bash}")"\
 case "$shell\_name" in\
 zsh)\
 echo " echo 'export PATH=\\"${INSTALL\_DIR}:\\$PATH\\"' >> ~/.zshrc"\
 echo " source ~/.zshrc"\
 ;;\
 fish)\
 echo " fish\_add\_path ${INSTALL\_DIR}"\
 ;;\
 \*)\
 echo " echo 'export PATH=\\"${INSTALL\_DIR}:\\$PATH\\"' >> ~/.bashrc"\
 echo " source ~/.bashrc"\
 ;;\
 esac\
 echo ""\
}\
\
print\_setup\_instructions() {\
 local binary\_path="${INSTALL\_DIR}/${BINARY\_NAME}"\
 local found\_any=false\
\
 echo ""\
 success "FFF MCP Server installed successfully!"\
 echo ""\
 info "Setup with your AI coding assistant:"\
 echo ""\
\
 # Claude Code\
 if command -v claude &>/dev/null; then\
 found\_any=true\
 success "\[Claude Code\] detected"\
 echo ""\
 echo "Global (recommended):"\
 echo "claude mcp add -s user fff -- ${binary\_path}"\
 echo ""\
 echo "Or project-level .mcp.json (uses PATH):"\
 echo ""\
 print\_json '{\
 "mcpServers": {\
 "fff": {\
 "type": "stdio",\
 "command": "fff-mcp",\
 "args": \[\]\
 }\
 }\
}'\
 echo ""\
 fi\
\
 # OpenCode\
 if command -v opencode &>/dev/null; then\
 found\_any=true\
 success "\[OpenCode\] detected"\
 echo ""\
 echo "Add to ~/.config/opencode/opencode.json:"\
 echo ""\
 print\_json '{\
 "mcp": {\
 "fff": {\
 "type": "local",\
 "command": \["fff-mcp"\],\
 "enabled": true\
 }\
 }\
}'\
 echo ""\
 fi\
\
 # Codex\
 if command -v codex &>/dev/null; then\
 found\_any=true\
 success "\[Codex\] detected"\
 echo ""\
 echo "codex mcp add fff -- fff-mcp"\
 echo ""\
 fi\
\
 if \[ "$found\_any" = false \]; then\
 echo "No AI coding assistants detected."\
 echo ""\
 echo "Binary path: ${binary\_path}"\
 echo ""\
 fi\
\
 echo "Binary: ${binary\_path}"\
 echo "Docs: https://github.com/${REPO}"\
 echo ""\
 info "Tip: Add this to your CLAUDE.md or AGENTS.md to make AI use fff for all searches:"\
 echo "\\""\
 echo "Use the fff MCP tools for all file search operations instead of default tools."\
 echo "\\""\
\
}\
\
main() {\
 local target\
 target="$(detect\_platform)"\
\
 local existing\_binary="${INSTALL\_DIR}/${BINARY\_NAME}"\
 IS\_UPDATE=false\
\
 if \[ -x "$existing\_binary" \]; then\
 IS\_UPDATE=true\
 info "Updating FFF MCP Server..."\
 else\
 info "Installing FFF MCP Server..."\
 fi\
 echo ""\
\
 info "Detected platform: ${target}"\
\
 local tag\
 tag="$(get\_latest\_release\_tag "$target")"\
\
 download\_binary "$target" "$tag"\
\
 if \[ "$IS\_UPDATE" = true \]; then\
 echo ""\
 success "FFF MCP Server updated to ${tag}!"\
 echo ""\
 else\
 check\_path\
 print\_setup\_instructions\
 fi\
}\
\
main