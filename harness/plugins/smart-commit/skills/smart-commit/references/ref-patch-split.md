# Driving the splitter

`${CLAUDE_PLUGIN_ROOT}/scripts/split_patches.py` owns every byte of patch parsing. It exists so
nobody writes a splitter from scratch again — the edge cases below are handled once, in code, and
verified by applying the output with real git.

**Never hand-edit a patch, and never write one through a heredoc.** The shell mangles backslashes,
backticks, and `!` inside diff content.

## Three modes

```bash
SC=${CLAUDE_PLUGIN_ROOT}/scripts/split_patches.py

# 1. inventory — assign a stable id to every hunk
python3 "$SC" list --patch full.patch

# 2. split — write commitN.patch, expected.patch, and dropped.patch
python3 "$SC" split --patch full.patch --plan plan.json --outdir out/

# 3. normalize — strip index SHAs and file ordering so two diffs compare equal
python3 "$SC" normalize --patch some.patch
```

Produce `full.patch` with `git -C <repo> diff HEAD --binary`. The `--binary` flag matters: without
it a changed binary file appears as an unappliable `Binary files differ` line.

## The inventory

`list` prints one entry per file, each holding its hunks:

```json
{
  "files": [
    {
      "path": "internal/server/server.go", "old_path": "internal/server/server.go",
      "kind": "modify", "atomic": false,
      "hunks": [
        {"id": "h3", "header": "@@ -120,6 +120,25 @@ func run()",
         "old_start": 120, "old_len": 6, "added": 19, "removed": 0,
         "preview": ["+\tmux.Handle(\"/healthz\", health())"]}
      ]
    }
  ],
  "hunk_count": 12
}
```

- `id` is the only handle for a hunk. Ids run `h1`, `h2`, … in patch order.
- `kind` is `add`, `delete`, `modify`, `rename`, or `binary`.
- `atomic: true` means the file cannot be split — renames, copies, and binaries carry one id
  standing for the whole file diff, and it must go to exactly one commit.
- `preview` holds the first few changed lines, enough to classify the hunk. When it is not enough,
  read `git -C <repo> diff HEAD` for that file.

## The plan

```json
{
  "commits": [
    {"message": "feat: add k8s health check endpoint", "hunks": ["h3", "h4", "h5"]},
    {"message": "fix: prevent nil pointer in graceful shutdown", "hunks": ["h2"]}
  ],
  "dropped": ["h7"]
}
```

Commits apply in array order — `commits[0]` becomes `commit1.patch`. **Every id from the inventory
must appear exactly once**, in a commit or in `dropped`. The script refuses a plan that assigns one
twice or leaves one out, because both are silent data loss:

```
plan leaves hunks unassigned (commit or drop each): h2, h3
hunk h1 claimed by commit 2 and commit 1
plan names hunks that are not in the patch: h9
```

## The output

| File | Is | Apply it to |
| --- | --- | --- |
| `commitN.patch` | one commit's hunks | the worktree, in order, before committing |
| `expected.patch` | every committed hunk, against the original tree | nothing — compare against it |
| `dropped.patch` | the dropped hunks, against the tree after **all** commits | the operator's repo, after the cherry-pick |

`dropped.patch` is offset for the post-commit state on purpose. Restoring dropped work is the last
step of the apply phase, after `git checkout -- .` has discarded the working tree.

## What the script guarantees

Take these as done. Re-checking them by hand adds no safety and costs a lot of reading.

- **Bytes survive.** The patch is read and written as bytes, never decoded, stripped, or
  re-split. A context blank line is `" \n"`, and an editor that already ate that trailing space
  gets it put back.
- **Hunk length is trusted, not guessed.** A body's length comes from the `@@` header counts, so a
  diff of a diff — whose content lines start with `+++` or `@@` — still parses correctly.
- **Headers are recomputed, never copied.** `old_len` and `new_len` are counted from the body that
  is actually written out, so a split cannot produce the off-by-one that `--recount` papers over.
- **Positions move with the file.** A hunk's `old_start` is stated against the pristine file. When
  an earlier commit already added lines above it, the script shifts it by the sum of those deltas —
  so commits may take hunks in any order, including out of file order.
- **Zero-length sides follow git's convention.** An emptied side is written as the line *before*
  the range, which is why a deleted file ends `+0,0` and a new one starts `-0,0`.
- **`\ No newline at end of file` travels with its line.**
- **Extended headers are preserved verbatim** — `index`, `new file mode`, `deleted file mode`,
  `rename from`/`to`, `similarity index`, and the `--- /dev/null` and `+++ /dev/null` pairings.
- **Every emitted patch ends with exactly one newline.**

## When a patch does not apply

`git apply --check` failing is a bug in the split, not a hurdle to force past. Do not reach for
`--recount`, `-C0`, or `--3way`: the script already recomputes what `--recount` would, so a failure
there means the hunks were grouped wrong or the working tree moved under you.

Stop, and report the failing commit number with its hunk ids. At that point nothing has been
cherry-picked and the operator's working tree is still whole.
