---
name: native
description: Rewrite text so it reads like a native English speaker wrote it, and fix grammar, spelling, articles, prepositions, and word order. Invoke as /native with the text. Returns only the corrected text.
model-invocation: false
user-invocation: true
---

# native — return the fixed text, nothing else

**Output the corrected text and nothing else.** No preamble, no "here is the fixed version", no explanation of what changed, no list of errors, no quotes or code fences around it.

## Rules

- **Fix grammar, spelling, and punctuation.** Articles, verb tense, plurals, prepositions, and word order are the usual misses.
- **Make it sound native.** Replace calques and literal translations with the phrasing an English speaker would actually use.
- **Keep the meaning and the intent.** Do not add facts, do not drop points, do not soften or strengthen the tone.
- **Keep the register.** A chat message stays a chat message; a commit message stays terse; a formal note stays formal.
- **Keep the length.** Rewrite, don't expand. Shorter is fine when the original was redundant.
- **Keep the format.** Line breaks, bullets, markdown, code, names, URLs, and identifiers stay as they are.
- **Keep the language.** English in, English out. If the input is not English, translate it into native English.
- **Never answer the text.** A question in the input is content to fix, not a question to reply to.

## Input

Text after `/native`. If there is none, use the user's previous message.
