---
name: forbidden-words
description: Add a word to the forbidden-words list in the global rules, so it never again appears in code. Use for "forbid the word X", "ban X in code", "add X to forbidden words", or `/forbidden-words <word>...`.
---

# Add a forbidden word to the rules

The list lives in one line of `~/Documents/git/dotfiles/harness/claude/CLAUDE.md`, inside the `<when="writing code">` block:

```
- Forbidden words — MUST NOT appear in a name, a string, a comment, or a commit message: `held`.
```

## Steps

1. Take the words from the arguments. Lowercase each word. Done when you hold a list of one or more words.
2. Append each word that is not in the list yet, as `` `word` ``, comma-separated, before the final period. Edit the repo file, not the `~/.claude` link. Done when `grep -c 'Forbidden words' harness/claude/CLAUDE.md` prints `1` and the line holds every new word.
3. Tell the operator which words you added and which were already there.
