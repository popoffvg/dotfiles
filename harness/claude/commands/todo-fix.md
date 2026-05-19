---
allowed-tools: Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git status:*), Grep, Read, Edit, TodoWrite
description: Search TODO/FIX in current diff, create task list, and solve all tasks
model: sonnet
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged): !`git diff HEAD`
- Current branch: !`git branch --show-current`

## Your task

### Step 1: Search for TODO and FIX comments in the diff

Search the current diff for TODO and FIX comments using grep with patterns:
- `TODO:` (case insensitive)
- `FIX:` (case insensitive) 
- `FIXME:` (case insensitive)

Extract the full lines containing these patterns and capture:
- File name and line number
- The complete TODO/FIX comment
- Context around the comment if needed

### Step 2: Create a task list

Based on the found TODO/FIX comments, create a structured task list using the TodoList tool. For each task:
- **content**: The TODO/FIX description (cleaned up, without the TODO/FIX prefix)
- **id**: Unique identifier (e.g., "todo-1", "fix-1")
- **priority**: "high" for FIX/FIXME, "medium" for TODO
- **status**: "pending"

### Step 3: Solve all tasks systematically

For each task in the task list:

1. **Mark as in_progress** when starting work on it
2. **Locate the relevant code** using Read and Grep tools
3. **Implement the solution**:
   - For FIX comments: Fix the described issue
   - For TODO comments: Implement the described feature/improvement
4. **Test the changes** if applicable
5. **Mark as completed** when done

### Step 4: Clean up TODO/FIX comments

After solving each task:
- Remove the TODO/FIX comment from the code
- If the comment contained useful information, consider replacing it with a brief explanatory comment

### Step 5: Stage and commit changes

Once all tasks are completed:
1. Stage all modified files: `git add <files>`
2. Create a commit with an appropriate message, e.g.:
   - `fix: resolve all TODO and FIX items in current diff`
   - `feat: implement all TODO items in current changes`

## Rules

- Always read the full context around TODO/FIX comments before implementing
- Focus on the current diff only - don't search the entire codebase
- If a TODO/FIX item is unclear, make reasonable assumptions and document them
- Remove TODO/FIX comments after resolving them
- Test changes when possible
- Use conventional commit messages
- Never skip git hooks or use `--no-verify`

## Example workflow

If the diff contains:
```diff
+ // TODO: Add input validation
+ function processInput(data) {
+   return data.trim();
+ }
+ 
+ // FIX: This should handle empty strings
+ function formatOutput(text) {
+   return text.toUpperCase();
+ }
```

You would:
1. Create tasks for "Add input validation" and "handle empty strings"
2. Implement input validation in `processInput`
3. Fix empty string handling in `formatOutput`
4. Remove the TODO/FIX comments
5. Commit the changes
