---
name: fix-comments
description: Read agent-review comments via MCP tools and/or GitHub PR review comments, fix each one in the code, and mark as applied. Use when user says "fix comments", "apply comments", or "resolve comments".
---

# Fix Agent Review Comments

Fix comments from local agent-review and/or GitHub PR reviews.

## Sources

Collect from **both** sources, merge into a single work list.

### Source 1: Local agent-comments (via MCP)

1. Call `comment_list(status: "pending")` to get all pending comments.
2. For each comment needing full context, call `comment_get(id)`.
3. Skip if no comments returned.

### Source 2: GitHub PR review comments

1. **Detect current PR**: run `gh pr view --json number,url,baseRefName --jq '.number'`. Skip if no PR.

2. **Fetch the review diff** (revdiff):
   ```bash
   gh pr diff --name-only   # list changed files
   gh pr diff               # full diff
   ```

3. **Fetch unresolved review comments**:
   ```bash
   gh api graphql -f query='
     query($owner:String!, $repo:String!, $pr:Int!) {
       repository(owner:$owner, name:$repo) {
         pullRequest(number:$pr) {
           reviewThreads(first:100) {
             nodes {
               isResolved
               comments(first:10) {
                 nodes { body path line databaseId author { login } }
               }
             }
           }
         }
       }
     }' -f owner=OWNER -f repo=REPO -F pr=NUMBER
   ```
   Extract `owner` and `repo` from `gh repo view --json owner,name`.

4. Filter to `isResolved: false`. Map to common format:
   - `absPath` = workspace root + `path`
   - `line` = comment `line` (diff-relative — resolve via revdiff)
   - `text` = comment `body`
   - `source` = `"github"`

### Resolving GitHub comment positions via revdiff

GitHub review comments reference line numbers **in the diff**, not in the current file.

**Algorithm:**
1. Parse the revdiff for the commented file. Extract hunk headers (`@@ -old,len +new,len @@`).
2. Locate the comment's line in the diff's new-file side (`+` and context lines).
3. Map diff position to current file line: walk the hunk counting `+` and context lines (skip `-` lines).
4. Read the current file at the mapped line and verify the code matches.
5. If diverged — extract distinctive tokens from revdiff context and search the current file.
6. If still ambiguous — use the comment `text` to narrow down.

**Never blindly trust the `line` number** from a review comment.

## Steps

1. **Group related comments** with the same fix pattern across files. Plan one consistent strategy.

2. **For each pending comment**:
   - Read the file at `absPath`
   - Go to the specified `line` (1-based)
   - Read `text` — it describes what to fix
   - Apply the fix using Edit tool
   - **Local source**: call `comment_update_status(id, status: "applied")`
   - **GitHub source**: do NOT resolve the thread (leave to reviewer)
   - If cannot fix: local → `comment_update_status(id, status: "failed", lastError: "reason")`; GitHub → note in summary

3. **Summary**: Print counts of applied, failed, skipped — by source (local / GitHub).

## Rules

- **Never read or edit `.vscode/agent-comments.json` directly** — use `comment_list`, `comment_get`, `comment_update_status` MCP tools
- Atomic edits — one logical change per comment
- Do not change code unrelated to the comment
- Equivalent comments across files → identical implementation (explain divergence in `lastError`)
- If `fileHash` mismatch, warn but still attempt
- If `absPath` doesn't exist → `comment_update_status(id, status: "failed", lastError: "file not found")`
- GitHub source optional — silently skip if no PR or `gh` unavailable
- Never resolve GitHub review threads
