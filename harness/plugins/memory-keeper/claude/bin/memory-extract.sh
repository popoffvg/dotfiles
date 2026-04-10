#!/usr/bin/env bash
# Stop hook — signals Claude to call memory_extract MCP tool.
# This hook fires at session end. It returns additionalContext
# instructing Claude to extract insights before the session closes.
#
# The actual extraction happens via the MCP server's memory_extract tool,
# not in this script. This hook just provides the instruction.

cat <<'EOF'
{
  "additionalContext": "SESSION ENDING: Call the memory_extract MCP tool now with a summary of the key topics discussed in this session. Include any architectural decisions, debugging discoveries, patterns learned, or workflow changes worth remembering."
}
EOF
