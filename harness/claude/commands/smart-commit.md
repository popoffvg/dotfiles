---
allowed-tools: Bash, Read, Write
description: Analyze diff across repos, propose logical commit split, get approval, then commit (parallel per repo)
argument-hint: "[apply]"
context: fork
background: true
model: sonnet
---

## Two phases

This command runs as a **background fork**. A background fork cannot block for a human answer,
so approval goes through an editable file instead of a prompt.

| Invocation | Phase | Does |
| --- | --- | --- |
| `/smart-commit` | **propose** | Steps 0–3. Writes the proposal file, reports its path, stops. Touches no git state. |
| `/smart-commit apply` | **apply** | Step 4. Reads the answered proposal file and commits. |

If `$ARGUMENTS` is `apply`, skip to Step 4. Otherwise run Steps 0–3 and stop at Step 3.

**Never** call `AskUserQuestion` — it never reaches the user from a background fork.

## Step 0: Discover git repos

The current directory may NOT be a git repo (e.g. task dirs, multi-repo workspaces).

1. Find all git repos with uncommitted changes:
```bash
{
  # Check if cwd itself is inside a git repo
  repo=$(git rev-parse --show-toplevel 2>/dev/null)
  if [ -n "$repo" ] && [ -n "$(git -C "$repo" status --porcelain 2>/dev/null)" ]; then
    echo "$repo"
  fi

  # Scan subdirectories (2 levels) for git repos
  # Note: .git can be a file (worktrees) or directory, so no -type filter
  find . -maxdepth 2 -name .git 2>/dev/null | while read gitpath; do
    repo=$(dirname "$gitpath")
    if [ -n "$(git -C "$repo" status --porcelain 2>/dev/null)" ]; then
      git -C "$repo" rev-parse --show-toplevel
    fi
  done
} | sort -u
```
2. For each discovered repo with changes, collect context **in parallel** (one Bash call per repo):
```bash
git -C <repo> status --short
git -C <repo> diff HEAD
git -C <repo> branch --show-current
git -C <repo> log --oneline -5
```
3. If NO repos with changes found, abort: "No git changes detected in or near current directory."

## Step 1: Analyze the diff (hunk-level)

For **each repo separately**, read all changes at **hunk granularity**:
```bash
git -C <repo> diff HEAD -U3
```

Parse the diff into individual hunks. Each hunk is identified by:
- File path
- Hunk header (`@@ -start,len +start,len @@`)
- The changed lines themselves

Group hunks into **logical units** — hunks from different files (or different parts of the same file) that belong to the same logical change:
- New features (together with their tests)
- Bug fixes
- Refactors
- Config / dependency changes
- Documentation

**Key**: a single file may contribute hunks to multiple commits. For example, if `server.go` has a bug fix in one function and a new feature in another, those hunks go into separate commits.

## Step 2: Propose the split

Write the proposal with the Write tool to `$TMPDIR/smart-commit-proposal.md`.

One **block per proposed commit**. Every block carries Source, Original, Recommended, and an
editable `**Answer:**` slot. An unedited `**Answer:** approve` means accept as-is.

For each commit show **only a compact chunk list** — no diff content, no code snippets:
- `file.go @@ <hunk header> — <5-word description>`
- If whole file: `file.go (whole file)`
- Commit message (imperative mood, ≤72 chars)

Use conventional commit types (see list below).

### Proposal file format

````markdown
# Smart Commit Proposal

Edit the `**Answer:**` line of each block, then run `/smart-commit apply`.

Answer values:
- `approve`              — commit as recommended
- `<new message>`        — commit these hunks, but with this message instead
- `merge into <N>`       — fold these hunks into commit N of the same repo
- `drop`                 — leave these hunks uncommitted in the working tree

Do NOT change the hunk identifiers (`file @@ range`) — only the `**Answer:**` lines.

---

## <repo> (branch: <branch>)

### 1. <type>: <message>

- **Source:** `<repo>/internal/server/server.go:120` · `<repo>/internal/server/health.go:1`
- **Original:**
  - `internal/server/server.go @@ -120,6 +120,25 @@` — register health route
  - `internal/server/health.go (whole file, new)`
  - `internal/server/health_test.go (whole file, new)`
- **Recommended:** `feat: add k8s health check endpoint` — isolated feature with its tests

**Answer:** approve

---

### 2. <type>: <message>

- **Source:** `<repo>/internal/server/server.go:45`
- **Original:**
  - `internal/server/server.go @@ -45,8 +45,10 @@` — nil check before closing listener
- **Recommended:** `fix: prevent nil pointer in graceful shutdown` — unrelated bugfix in same file

**Answer:** approve

---
````

Repeat the `## <repo>` heading plus its blocks for every repo. Commit numbering restarts at 1
per repo.

If all changes in a repo belong in one commit, write one block and say so in its Recommended line.

Use conventional commit types:
- **feat**: New features or functionality
- **fix**: Bug fixes or error corrections
- **test**: Adding or updating tests
- **doc**: Documentation changes (README, comments, docs)
- **refactor**: Code refactoring without functional changes
- **chore**: Maintenance tasks, dependencies, config changes
- **perf**: Performance improvements
- **style**: Code formatting, linting, style changes


If all changes belong in one commit per repo, say so.

## Step 3: Hand the proposal to the user and stop

Print the **resolved absolute path** (expand `$TMPDIR`, do not print the literal variable):

```bash
echo "$TMPDIR/smart-commit-proposal.md"
```

Then end the phase with this message, filled in:

> Proposal at `<absolute path>` — N commits across M repo(s).
> Edit the `**Answer:**` lines, then run `/smart-commit apply`.

**Stop here.** Do not run any git write command. The propose phase must leave the working tree
and the repo history untouched.

## Step 4: Execute commits (worktree + patch + cherry-pick)

Runs only on `/smart-commit apply`.

### 4.0 Read the answers

1. Read `$TMPDIR/smart-commit-proposal.md`. If it is missing, abort: "No proposal found — run `/smart-commit` first."
2. Extract the verdicts — grep the answer slots, do not reparse the whole file:
```bash
grep -n '^\*\*Answer:\*\*' "$TMPDIR/smart-commit-proposal.md"
```
3. Map each answer back to its block by line order, and resolve it:

| Answer | Effect |
| --- | --- |
| `approve` (or empty) | commit these hunks with the Recommended message |
| any other free text | commit these hunks with that text as the message |
| `merge into <N>` | append these hunks to commit N of the same repo; drop this commit |
| `drop` | leave these hunks uncommitted in the working tree |

4. Re-read the `- **Original:**` hunk lists to get the hunk identifiers for each surviving commit.
5. If every block says `drop`, abort: "All commits dropped — nothing to do."
6. Print the resolved plan (repo → commit number → message → hunk count) before touching git.

Hunks marked `drop` are **excluded** from the reconstruction check in §4.4 — see the note there.


Use a **git worktree** to build commits in isolation, then cherry-pick them back.

### 4.1 Setup

For each repo:
```bash
REPO=<repo>
WTDIR=$TMPDIR/smart-commit-wt-$(basename $REPO)
BASE_BRANCH=$(git -C "$REPO" branch --show-current)

# Save full diff from working tree (tracked changes)
git -C "$REPO" diff HEAD > "$TMPDIR/full-$(basename $REPO).patch"

# Save list of untracked files (for cherry-pick conflict prevention)
git -C "$REPO" ls-files --others --exclude-standard > "$TMPDIR/untracked-$(basename $REPO).txt"

# Create worktree on a temp branch from HEAD
git -C "$REPO" worktree add -b _smart-commit-tmp "$WTDIR" HEAD
```

### 4.2 Generate per-commit patch files

Use a **Python script file** (NOT heredoc, NOT inline python3 -c) to split the full patch into per-commit patches. Write the script with the Write tool to `$TMPDIR/split_patches.py`, then run it.

The script must:
1. Parse the full diff into (file, hunk) pairs
2. For each commit in the approved proposal, collect its hunks
3. Write each commit's hunks to `$TMPDIR/commitN.patch` as a valid unified diff

**CRITICAL — shell escaping hazard**: Heredocs and inline `python3 -c`/`python3 << 'EOF'` silently mangle special characters like `\!`, backticks, and `!=` in certain contexts. **Always use Write tool to create .py scripts, then `python3 $TMPDIR/script.py` to run them.**

Similarly, **never write patch files via heredoc** (`cat > file.patch << 'EOF'`). Special characters in diff content (backslashes, exclamation marks, backticks) get mangled by the shell. Instead:
- Use `git diff` to generate patches programmatically, OR
- Use a Python script (written via Write tool) to extract and write patch files, OR
- Use `git format-patch` for whole-commit patches

#### Patch parsing — edge cases that MUST be handled

These are the failure modes that silently corrupt split patches. Every splitter script must handle all of them.

1. **Blank lines in hunks are NOT hunk terminators.** A context blank line in unified diff format is `" \n"` (a single space followed by newline), not `"\n"`. Some editors/tools strip trailing whitespace and turn `" \n"` into `"\n"` — that breaks `git apply` with "corrupt patch" or "while searching for". Read the patch in **binary mode** (`open(path, "rb")`) or with `newline=""` to preserve bytes exactly. **Never** `.strip()`, `.rstrip()`, or `.splitlines()` without `keepends=True`.

2. **A hunk body line must start with one of `' '`, `'+'`, `'-'`, `'\'`.** A line with no leading marker means the hunk has ended. Detect hunk boundaries by this rule plus the next `@@ ` or `diff --git` header — do NOT split on `\n\n`.

3. **`\ No newline at end of file`** markers belong to the preceding `+`, `-`, or ` ` line. They must travel with that line into the output hunk, or the patch is invalid.

4. **Line counts in `@@ -a,b +c,d @@` must match the body.** `b` = count of ` ` and `-` lines; `d` = count of ` ` and `+` lines. After splitting, if you drop or reorder lines you MUST recompute `b` and `d`, or use `git apply --recount` when applying. Mismatched counts produce silent off-by-one corruption.

5. **`old_start` (the `a` in `@@ -a,b ...`) becomes wrong after earlier commits patch the same file.** The original full diff numbers each hunk against the pristine file; once commit 1 adds 5 lines, commit 2's hunk header for the same file is off by 5. Two acceptable strategies — pick one and apply it consistently:
   - **Recompute headers**: for each commit's hunks (sorted by `old_start` ascending), track a running `delta = sum(new_len - old_len)` from earlier hunks of THAT COMMIT only, AND a `prior_delta` from prior commits' hunks. Adjust `old_start` by `prior_delta` before writing.
   - **Apply with `--recount` and `-C0`**: skip header math, let git recount. This is more forgiving but masks real corruption. Always pair with the per-file verify in §4.4.

6. **Special headers must be preserved verbatim**: `diff --git a/x b/y`, `index abc..def 100644`, `new file mode`, `deleted file mode`, `rename from`/`rename to`, `similarity index`, `--- a/x`, `+++ b/y`. Drop any of these and `git apply` either silently no-ops or fails.

7. **Renames and binary files cannot be hunk-split.** Detect (`rename from`, `GIT binary patch`, `Binary files ... differ`) and assign the whole file-diff to one commit; refuse to split it.

8. **New / deleted files** use `--- /dev/null` or `+++ /dev/null`. The splitter must keep these special source/target lines paired with the corresponding `new file mode`/`deleted file mode`. A deleted file must not be assigned to multiple commits.

9. **CRLF / BOM**: read and write patches as bytes. Do not decode/re-encode. Do not let the editor add a trailing newline that wasn't in the source.

10. **Trailing newline of the patch file**: the patch must end with exactly one `\n`. Missing it makes `git apply` fail on some versions.

#### Pre-apply sanity checks (run inside the script before writing each patch)

For every generated `commitN.patch`:
- Re-parse it and assert: hunk header counts match body counts (rule 4).
- Assert: every body line starts with ` `, `+`, `-`, or `\`.
- Assert: each `diff --git` block has matching `---`/`+++` lines.
- Run `git -C "$WTDIR" apply --check "$TMPDIR/commitN.patch"` — this dry-runs the apply without touching the worktree. If it fails, fix the patch (or fall back to `--recount`) **before** any real apply.

### 4.3 Apply patches and commit sequentially in the worktree

For each commit (in order):
```bash
# Dry-run first — never apply blindly
git -C "$WTDIR" apply --check "$TMPDIR/commitN.patch" || {
  # Try recovery ladder before giving up
  git -C "$WTDIR" apply --check --recount "$TMPDIR/commitN.patch" \
    || git -C "$WTDIR" apply --check -C0 --recount "$TMPDIR/commitN.patch" \
    || { echo "patch N invalid"; exit 1; }
}
git -C "$WTDIR" apply --recount "$TMPDIR/commitN.patch"
git -C "$WTDIR" add <specific files touched by this commit>
# Confirm staged content matches the patch intent: no other files crept in
git -C "$WTDIR" diff --cached --name-only | sort > "$TMPDIR/staged-N.txt"
git -C "$WTDIR" commit -m "<message>"
```

Recovery ladder for `git apply` failures (try in order, stop at first success):
1. `git apply --recount` — let git recompute hunk line counts (fixes rule 4/5 drift).
2. `git apply --3way` — synthesize a merge if the blob is recorded.
3. `git apply -C0 --recount` — drop context matching, recount.
4. If all four fail, abort the whole commit run and report which hunk failed — do NOT silently skip it.

### 4.4 Verify

Two independent checks — both must pass before §4.5.

**Dropped hunks change the baseline.** If any block answered `drop`, the commits must NOT reproduce
the full working-tree diff. Build the expected baseline first:
```bash
# full diff minus the dropped hunks — this is what the commits must reconstruct
python3 $TMPDIR/split_patches.py --exclude-dropped > "$TMPDIR/expected-$(basename $REPO).patch"
```
Then use `expected-*.patch` in place of `full-*.patch` in Check B, and skip Check A for any file
that has a dropped hunk (its worktree copy legitimately differs from `$REPO`).

**Check A — per-file content equivalence** (catches dropped or duplicated hunks):
```bash
# Compare worktree final state against original working tree, byte-exact.
for f in <all changed files>; do
    diff -q "$WTDIR/$f" "$REPO/$f" || { echo "MISMATCH: $f"; exit 1; }
done
```

**Check B — aggregate diff equivalence** (catches reordering, partial hunks, or whitespace drift):
```bash
# The sum of all new commits must equal the original full diff.
git -C "$WTDIR" diff "$BASE_BRANCH"..HEAD > "$TMPDIR/reconstructed.patch"
# Normalize both diffs (sort hunks, strip index lines) before comparing — index SHAs
# legitimately differ. Use a Python script for normalization, not sed.
python3 $TMPDIR/normalize_diff.py "$TMPDIR/full-$(basename $REPO).patch" > "$TMPDIR/full-norm.patch"
python3 $TMPDIR/normalize_diff.py "$TMPDIR/reconstructed.patch"        > "$TMPDIR/reconstructed-norm.patch"
diff -u "$TMPDIR/full-norm.patch" "$TMPDIR/reconstructed-norm.patch" || {
  echo "Reconstructed diff does not match original. Aborting before cherry-pick."
  exit 1
}
```

**Check C — commit set sanity**:
```bash
# Expected count of new commits = number of commit sections in proposal
test "$(git -C "$WTDIR" rev-list --count "$BASE_BRANCH"..HEAD)" = "<N>"
```

If ANY check fails: do NOT proceed to cherry-pick. Investigate, fix the splitter script, regenerate patches, and re-run from §4.3.

### 4.5 Cherry-pick back to original branch

```bash
# Discard tracked working tree changes in original repo (we have them in commits now)
# SAFE: the full pre-change diff is already saved at $TMPDIR/full-$(basename $REPO).patch
git -C "$REPO" checkout -- .

# Move aside untracked files that would conflict with cherry-pick.
# Git refuses to overwrite untracked files during cherry-pick — this prevents that.
BACKUP="$TMPDIR/smart-commit-untracked-$(basename $REPO)"
mkdir -p "$BACKUP"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  # Check if this file exists in any worktree commit
  if git -C "$WTDIR" ls-tree -r --name-only HEAD -- "$f" > /dev/null 2>&1; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    mv "$REPO/$f" "$BACKUP/$f"
  fi
done < "$TMPDIR/untracked-$(basename $REPO).txt"

# Cherry-pick all new commits from worktree branch
git -C "$REPO" cherry-pick <commit1-sha> <commit2-sha> ...

# Clean up backup (files are now in commits)
rm -rf "$BACKUP"
```

If any block answered `drop`, restore those hunks to the working tree — §4.5 discarded them:
```bash
# dropped.patch = the hunks excluded in §4.4, written by the splitter script
git -C "$REPO" apply --check "$TMPDIR/dropped-$(basename $REPO).patch" \
  && git -C "$REPO" apply "$TMPDIR/dropped-$(basename $REPO).patch" \
  || { echo "FAILED to restore dropped hunks — recover from $TMPDIR/full-$(basename $REPO).patch"; exit 1; }
```

Verify:
```bash
git -C "$REPO" log --oneline -N  # N = number of new commits + a few
git -C "$REPO" status --short    # untracked files, plus dropped hunks if any were dropped
```

### 4.6 Cleanup

```bash
git -C "$REPO" worktree remove "$WTDIR" --force
git -C "$REPO" branch -D _smart-commit-tmp
```

### Parallel execution

Repos are **independent** — run the full worktree workflow for different repos **in parallel** (separate Bash calls per repo). Within a single repo, commits are sequential.

**Never** use `git add .` or `git add -A`.

## Rules
- Always use `git -C <repo>` — never bare `git` commands
- Never skip hooks (`--no-verify`)
- Never amend already-pushed commits
- No "Co-Authored-By" AI lines
- No "Generated with Claude Code" footers
- If a hook fails: fix the issue, re-stage, create a NEW commit
- **Never use heredoc to write patch files or Python scripts** — use Write tool instead
- Try 2 times, if all fails: abort
- **Never call `AskUserQuestion`** — this runs as a background fork; the question never reaches the user
- The propose phase is read-only on git. Every git write lives in Step 4 (`apply`)
- On abort, report the reason in the final message — a background fork has no other channel
