#!/usr/bin/env bash
# Run the mized-mcp bridge of the miZed fork at ZED_FORK_DIR.
# No arguments: an MCP stdio server for an agent config. `list` and `call <tool> [json|-]`: one CLI call.
# miZed writes its socket path to the address file only when it starts with MIZED_MCP_ADDRESS_FILE set;
# the com.vitalii.mized-mcp-env LaunchAgent sets it for GUI apps.
set -euo pipefail

fork_dir=${ZED_FORK_DIR:-$HOME/Documents/git/zed}
address_file=${MIZED_MCP_ADDRESS_FILE:-$HOME/.mized-mcp-address}

for profile in release debug; do
	bin=$fork_dir/target/$profile/mized-mcp
	[[ -x $bin ]] && exec "$bin" "$address_file" "$@"
done

printf 'mized-mcp: no binary in %s/target/{release,debug}; run: cargo build --release -p mized_mcp --bin mized-mcp\n' "$fork_dir" >&2
exit 1
