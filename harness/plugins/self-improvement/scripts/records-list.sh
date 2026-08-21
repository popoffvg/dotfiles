#!/usr/bin/env bash
# List every session the tool has a record for.
#
#   <session-id>  <record-path>  <watermark>  <seen-bytes>  <score>  <scope>  <suggestion-verdict>  <archive>
#
# The tool side of the scan's join. `watermark` is the transcript line of the
# last human prompt already judged; `seen-bytes` is the file size at that pass.
# The first is semantic (what to re-read), the second is the cheap dirty check.
#
# `suggestion-verdict` is empty until the suggestion stage has run on that
# session, which is exactly how the scan finds its candidates: a kept score with
# no verdict yet.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -d "$records_dir" ] || exit 0

# One jq invocation for the whole directory: 1000+ records would otherwise mean
# 1000+ process spawns, which dominates the runtime of an otherwise trivial scan.
find "$records_dir" -type f -name '*.json' -print0 2>/dev/null \
  | xargs -0 jq -r '[.session, input_filename, (.watermark // 0),
                     (.seen_bytes // 0), (.score // "-"), (.scope // "-"),
                     (.suggestion_verdict // ""), (.archive // "")] | @tsv' 2>/dev/null \
  | sort
