---
name: notify-me
description: Send a desktop notification to the user when they ask to be notified upon task completion. Use this skill when the user says "let me know when done", "notify me", "ping me", "let me know", "I'll check back", "wait for it", "tell me when", "give me a heads up", or any similar phrase indicating they want a notification when the current task finishes.
---

# Notify Me

The user wants a desktop notification when the current task is complete.

## Instructions

1. Acknowledge the request briefly: e.g. _"I'll notify you when done."_
2. Proceed with the task normally.
3. **At the very end**, once all work is complete, call the `notify` tool with a concise summary message.

## Notification message guidelines

- Keep it short (≤ 60 chars)
- State what finished, not just "done"
- Examples:
  - `"Build complete — no errors"`
  - `"Tests passed (42/42)"`
  - `"Refactor done: auth module"`
  - `"Research complete"`

## Example

User: "Run the test suite and let me know"

→ Run tests → at the end call:
```
notify("Tests passed: 42/42")
```
