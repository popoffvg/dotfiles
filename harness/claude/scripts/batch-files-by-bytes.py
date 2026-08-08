#!/usr/bin/env python3
"""batch-files-by-bytes.py — split a directory's files into size-balanced batches.

Count-based batching blows up when file sizes are skewed: a batch of N large files
can be several times the token budget of a batch of N small ones. Pack by bytes so
every batch lands near the same size, and no batch exceeds a subagent's context.

Writes <out-dir>/batch-NNN.txt, one filename per line, and prints a summary.

Usage:  batch-files-by-bytes.py <src-dir> <out-dir> [--target-kb N] [--glob PATTERN]
"""
import os
import sys
import glob as globmod


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    src, out = sys.argv[1], sys.argv[2]
    target = 200 * 1024
    if "--target-kb" in sys.argv:
        target = int(sys.argv[sys.argv.index("--target-kb") + 1]) * 1024
    pattern = "*.md"
    if "--glob" in sys.argv:
        pattern = sys.argv[sys.argv.index("--glob") + 1]

    files = sorted(globmod.glob(os.path.join(src, pattern)))
    if not files:
        sys.exit(f"no files matching {pattern} in {src}")
    os.makedirs(out, exist_ok=True)
    for stale in globmod.glob(os.path.join(out, "batch-*.txt")):
        os.remove(stale)

    # Longest-first packing keeps the tail batches from being all-large.
    sized = sorted(((os.path.getsize(f), f) for f in files), reverse=True)

    batches, cur, cur_bytes = [], [], 0
    for size, path in sized:
        if cur and cur_bytes + size > target:
            batches.append((cur, cur_bytes))
            cur, cur_bytes = [], 0
        cur.append(path)
        cur_bytes += size
    if cur:
        batches.append((cur, cur_bytes))

    for i, (paths, nbytes) in enumerate(batches, 1):
        with open(os.path.join(out, f"batch-{i:03}.txt"), "w", encoding="utf8") as fh:
            fh.write("\n".join(os.path.basename(p) for p in paths) + "\n")

    total = sum(b for _, b in batches)
    sizes = sorted(b for _, b in batches)
    print(f"src:     {src}")
    print(f"files:   {len(files)}  ({total/1024/1024:.1f} MB)")
    print(f"batches: {len(batches)}  -> {out}/batch-001.txt .. batch-{len(batches):03}.txt")
    print(f"per batch bytes: min {sizes[0]/1024:.0f}KB  median {sizes[len(sizes)//2]/1024:.0f}KB  max {sizes[-1]/1024:.0f}KB")
    print(f"per batch files: min {min(len(p) for p,_ in batches)}  max {max(len(p) for p,_ in batches)}")


if __name__ == "__main__":
    main()
