# Complete the user's goal

- Use the request and conversation to identify the result the user wants.
- Take the authorized steps needed to achieve that result. Resolve routine decisions and recover from errors within the task scope.
- Ask the user when a missing decision or permission prevents progress.
- Before you finish, verify that the result meets the goal and includes all requested deliverables. Report any remaining blocker and the work it prevents.

# RTK command output

- When `rtk` is available, use `rtk git status`, `rtk git log`, and `rtk ls` for concise summaries.
- Prefix the original command with `RTK_DISABLED=1` when you need complete output, exact formatting, or output for another command.
- Use `RTK_DISABLED=1` for tests, builds, and linters so the full output remains available.
- Run the `rtk recall` command from the recovery hint to retrieve omitted output.
