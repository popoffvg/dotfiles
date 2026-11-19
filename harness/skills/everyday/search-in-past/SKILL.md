---
name: search-in-past
description: Find a conversation or detail in Claude session history. Load when the user asks to search this session, search previous sessions, or find a conversation.
---

# Search in past sessions

## Product

Return matching conversations with dates, session paths, and short evidence excerpts.

## Reader

The user uses the matches to locate or resume a past conversation.

## Properties

- Each match names the date and session file.
- Each match includes a short excerpt that supports the match.
- Report when the search found no match.
- Do not treat a partial search as exhaustive.

## Cause

Session history can span many files. One subagent keeps the search outside the main context.

## Steps

1. Resolve {light} through the active harness effort ledger and start one generated `effort-light` subagent.
2. Give it the search terms, the likely date range, and the session locations under `~/.claude/projects/`.
3. Ask it to search current and previous sessions as requested. It must return matching transcript paths, timestamps, and evidence excerpts.
4. Report the matches and state the scope searched. Do not claim an exhaustive search if files were inaccessible or omitted.
