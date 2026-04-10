---
name: fix-comments
description: Read agent-review comments from .vscode/agent-comments.json, fix each pending comment in the code, and mark it as applied. Use when user says "fix comments", "apply comments", or "resolve comments".
---

# Fix Agent Review Comments

Read the agent-review comments file and apply fixes to the codebase.

## Steps

1. **Read the comments file** at `.vscode/agent-comments.json` in the current workspace root. If it doesn't exist, tell the user there are no comments.

2. **Parse the JSON**. The format is:
   ```json
   {
     "version": 1,
     "comments": [
       {
         "id": "uuid",
         "absPath": "/absolute/path/to/file.ts",
         "line": 10,
         "text": "Description of what to fix",
         "fileHash": "sha256hex",
         "createdAt": "ISO8601",
         "status": "pending",
         "resolved": false
       }
     ]
   }
   ```

3. **Filter** to only `status: "pending"` (or missing status) comments. Skip `applied`, `failed`, `skipped`, or `resolved: true`.

4. **For each pending comment**, in order:
   - Read the file at `absPath`
   - Go to the specified `line` (1-based)
   - Read the `text` field — it describes what needs to be fixed
   - Apply the fix using Edit tool
   - After fixing, update the comment entry in the JSON: set `"status": "applied"`
   - If you cannot fix it, set `"status": "failed"` and `"lastError": "reason"`

5. **Write back** the updated JSON to `.vscode/agent-comments.json` after processing all comments.

6. **Summary**: Print how many comments were applied, failed, or skipped.

## Rules

- Make atomic edits — each comment fix should be a single logical change
- Do not change code unrelated to the comment
- If the file hash (`fileHash`) doesn't match the current file content, warn the user but still attempt the fix
- If `absPath` doesn't exist, mark as failed
- If `line` is out of range, use context from `text` to find the right location
