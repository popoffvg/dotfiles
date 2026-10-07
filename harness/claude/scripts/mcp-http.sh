#!/usr/bin/env bash
# Same as mcp-http-call.sh; this name stays for older callers.
exec "$(dirname "$0")/mcp-http-call.sh" "$@"
