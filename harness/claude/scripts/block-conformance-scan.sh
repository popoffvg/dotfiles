#!/usr/bin/env bash
# Inventory structural conformance of Platforma blocks under a root dir.
# Usage: block-conformance-scan.sh <blocks-root> [out.tsv]
# Emits a TSV: one row per block, one column per checked property.
set -uo pipefail

ROOT="${1:?blocks root required}"
OUT="${2:-/dev/stdout}"

has()  { [ -e "$1" ] && echo 1 || echo 0; }
jqs()  { node -e 'try{const p=require(process.argv[1]);let v=p;for(const k of process.argv[2].split("."))v=v?.[k];console.log(v===undefined?"":String(v))}catch(e){console.log("")}' "$1" "$2" 2>/dev/null; }
grepq(){ grep -rqs "$1" "$2" 2>/dev/null && echo 1 || echo 0; }

{
printf 'block\tfacade\tfacade_private\tmeta_title\tmeta_desc\tmeta_logo\tmeta_org\t'
printf 'model\tworkflow\tui\ttest\tsoftware\t'
printf 'modelapi\tturbo\twsyaml\tchangeset_dir\tchangeset_pending\tupgrade_sdk\t'
printf 'script_build\tscript_builddev\tscript_devremote\tscript_lint\tscript_typecheck\tscript_test\t'
printf 'eslint_model\teslint_ui\tui_indexhtml\ttengo_tests\tts_tests\tgh_workflows\t'
printf 'readme\tchangelog\tlicense\tlogos\tdocs\tclaudemd\n'

for d in "$ROOT"/*/; do
  n="$(basename "$d")"
  case "$n" in runenv-*|software-*|assets-*|MMseqs2|mnz-examples|milaboratories-block-specs) continue;; esac
  # a block has at least model+workflow
  { [ -d "$d/model" ] && [ -d "$d/workflow" ]; } || continue

  bpkg="$d/block/package.json"
  facade=$(has "$bpkg")
  fpriv=""; mt=""; md=""; ml=""; mo=""
  if [ "$facade" = 1 ]; then
    fpriv=$(jqs "$bpkg" "private"); [ -n "$fpriv" ] || fpriv=false
    mt=$([ -n "$(jqs "$bpkg" "block.meta.title")" ] && echo 1 || echo 0)
    md=$([ -n "$(jqs "$bpkg" "block.meta.description")" ] && echo 1 || echo 0)
    ml=$([ -n "$(jqs "$bpkg" "block.meta.logo")" ] && echo 1 || echo 0)
    mo=$([ -n "$(jqs "$bpkg" "block.meta.organization")" ] && echo 1 || echo 0)
  fi

  # model API version: V3 uses BlockModelV3.create
  if [ "$(grepq 'BlockModelV3' "$d/model/src")" = 1 ]; then api=V3
  elif [ "$(grepq 'BlockModel' "$d/model/src")" = 1 ]; then api=V1
  else api="?"; fi

  rp="$d/package.json"
  cs_pending=0
  [ -d "$d/.changeset" ] && cs_pending=$(find "$d/.changeset" -name '*.md' ! -name 'README.md' 2>/dev/null | wc -l | tr -d ' ')

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t' "$n" "$facade" "$fpriv" "$mt" "$md" "$ml" "$mo"
  printf '%s\t%s\t%s\t%s\t%s\t' "$(has "$d/model")" "$(has "$d/workflow")" "$(has "$d/ui")" "$(has "$d/test")" "$(has "$d/software")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t' "$api" "$(has "$d/turbo.json")" "$(has "$d/pnpm-workspace.yaml")" "$(has "$d/.changeset")" "$cs_pending" "$([ -n "$(jqs "$rp" "scripts.upgrade-sdk")" ] && echo 1 || echo 0)"
  for s in build build:dev build:dev-remote lint type-check test; do
    printf '%s\t' "$([ -n "$(jqs "$rp" "scripts.$s")" ] && echo 1 || echo 0)"
  done
  printf '%s\t%s\t%s\t' "$(has "$d/model/eslint.config.mjs")" "$(has "$d/ui/eslint.config.mjs")" "$(has "$d/ui/index.html")"
  printf '%s\t' "$(find "$d/workflow" -name '*.test.tengo' 2>/dev/null | wc -l | tr -d ' ')"
  printf '%s\t' "$(find "$d/test" -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')"
  printf '%s\t' "$(find "$d/.github/workflows" -name '*.y*ml' 2>/dev/null | wc -l | tr -d ' ')"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(has "$d/README.md")" "$(has "$d/CHANGELOG.md")" \
    "$([ -e "$d/LICENSE" ] || [ -e "$d/LICENSE.md" ] && echo 1 || echo 0)" \
    "$(has "$d/logos")" "$(has "$d/docs")" "$(has "$d/CLAUDE.md")"
done
} > "$OUT"
