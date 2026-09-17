#!/usr/bin/env bash
# Cross-build one Go package for several platforms and write SHA256SUMS.
#
#   go-crossbuild.sh <package> <out-dir> [name] [platform ...]
#
#   package   Go package path, e.g. ./helm/installer
#   out-dir   where the binaries land; created if absent
#   name      binary base name; defaults to the package's base name
#   platform  os/arch pairs; defaults to the six below
#
# Runs from the module directory, so cd there first. CGO is off so the binaries
# are static and cross-building needs no toolchain per target.

set -euo pipefail

if [ $# -lt 2 ]; then
    sed -n '2,12p' "$0" >&2
    exit 2
fi

PACKAGE="$1"
OUT_DIR="$2"
NAME="${3:-$(basename "$PACKAGE")}"
shift 3 2>/dev/null || shift $#

PLATFORMS=("$@")
if [ ${#PLATFORMS[@]} -eq 0 ]; then
    PLATFORMS=(
        darwin/arm64
        darwin/amd64
        linux/amd64
        linux/arm64
        windows/amd64
        windows/arm64
    )
fi

mkdir -p "$OUT_DIR"

failed=0
built=()

for platform in "${PLATFORMS[@]}"; do
    goos="${platform%%/*}"
    goarch="${platform##*/}"

    output="$OUT_DIR/$NAME-$goos-$goarch"
    if [ "$goos" = "windows" ]; then
        output="$output.exe"
    fi

    printf '%-22s' "$platform"
    if CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
        go build -trimpath -ldflags='-s -w' -o "$output" "$PACKAGE" 2>/tmp/crossbuild.err; then
        size=$(du -h "$output" | cut -f1 | tr -d ' ')
        printf 'ok    %s\n' "$size"
        built+=("$(basename "$output")")
    else
        printf 'FAILED\n'
        sed 's/^/    /' /tmp/crossbuild.err >&2
        failed=$((failed + 1))
    fi
done

if [ ${#built[@]} -gt 0 ]; then
    (
        cd "$OUT_DIR"
        if command -v sha256sum >/dev/null 2>&1; then
            sha256sum "${built[@]}" > SHA256SUMS
        else
            shasum -a 256 "${built[@]}" > SHA256SUMS
        fi
    )
    echo
    echo "SHA256SUMS written for ${#built[@]} binaries"
fi

exit $((failed > 0))
