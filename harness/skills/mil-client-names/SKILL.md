---
name: mil-client-names
description: "Sync — copy the client names of customer-ssot into ~/git/mil/client-names.txt, the list the mil pre-commit hook blocks. Use for \"sync client names\", \"get clients from ssot\", \"update the client list\", or after a new account lands in customer-ssot."
---

# mil-client-names

1. Pull `customer-ssot`: `git -C ~/git/mil/customer-ssot pull --ff-only`. If it fails with "Repository not found", run it again with `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com:`. Done when `git -C ~/git/mil/customer-ssot status -sb` shows no `behind`.
2. Merge the names: `~/.config/git/mil-hooks/ssot-client-names --merge ~/git/mil/client-names.txt > "$TMPDIR/added-names.txt"`. The script skips each name in `~/.config/git/mil-hooks/common-words`. Done when the command exits 0. An empty file means nothing is new: go to step 4.
3. Find the false hits of the added names in the current code. Scan each directory `~/git/mil/*/` that has a `.git` (a dir or a file), except `customer-ssot`, which is the source. Skip a checkout that copies another repo (`*.pr-*`, `*.agent-*`). In each one, run `git ls-files -z | MIL_CLIENT_NAMES="$TMPDIR/added-names.txt" MIL_CLIENT_CHECK=grep xargs -0 ~/.config/git/mil-hooks/client-check files` from the repo root. Exit 1 means hits; read them. Each hit line is `<file>:<line>: "<name>"`. Judge each name once:
   - A common word, a placeholder, or a vendor kit or file format (not the client): delete the name from `~/git/mil/client-names.txt` and add it to `~/git/dotfiles/git/dot-config/git/mil-hooks/common-words` (case does not matter).
   - The client itself: keep the name. Note the hit as client data that is already in the code.

   Done when every name with a hit is deleted or kept.
4. Report in chat only, never in a file, a git repo, a gist, or a page, because the report holds client names: the names added, the names moved to `common-words`, and the client data already in the code, grouped by repo. Leave the `common-words` change uncommitted for the operator.
