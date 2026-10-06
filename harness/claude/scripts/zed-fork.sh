#!/usr/bin/env bash
# Run the Zed CLI of the fork at ZED_FORK_DIR against the fork's own app build.
# Link ~/.local/bin/zed here to make every `zed` call on PATH open the fork.
# The CLI and the app MUST come from one build: they speak a private IPC protocol.
set -euo pipefail

fork_dir=${ZED_FORK_DIR:-$HOME/Documents/git/zed}
profile=${ZED_FORK_PROFILE:-debug}
cli=$fork_dir/target/$profile/cli
app=$fork_dir/target/$profile/zed

for bin in "$cli" "$app"; do
	[[ -x $bin ]] || {
		printf 'zed-fork: %s missing; run: cargo build -p cli -p zed%s in %s\n' \
			"$bin" "$([[ $profile == release ]] && echo ' --release')" "$fork_dir" >&2
		exit 1
	}
done

exec "$cli" --zed "$app" "$@"
