# Prompt rubric

Score 1-5 on each dimension. Total /25.

## Dimensions

1. **Goal clarity** — is the desired outcome unambiguous?
   - 5: single, specific, verifiable goal
   - 3: goal stated but with hidden assumptions
   - 1: vague verb only ("fix", "improve", "make better")

2. **Context** — files, errors, repro, prior attempts mentioned?
   - 5: paths/lines/errors cited, prior attempts named
   - 3: rough area named but no specifics
   - 1: bare reference ("the bug", "that file")

3. **Success criteria** — how do we know we're done?
   - 5: explicit test, behavior, or acceptance condition
   - 3: implicit but inferable
   - 1: none

4. **Scope** — what NOT to do is stated when relevant?
   - 5: bounded scope, no-go zones called out
   - 3: scope implicit
   - 1: open-ended ("refactor everything")

5. **Resolvability** — pronouns/references resolvable without guessing?
   - 5: no unresolved "it"/"this"/"that"
   - 3: one ambiguous pronoun
   - 1: multiple unresolved references

## Output format (JSON only)

```json
{
  "score": 14,
  "dimensions": {
    "goal": 3, "context": 2, "success": 1, "scope": 4, "resolvability": 4
  },
  "issues": [
    {"dim": "context", "msg": "no file path — which worker file?"},
    {"dim": "success", "msg": "what does 'fix' mean — test? behavior?"}
  ],
  "rewrite": "Fix the nil deref in worker/X.mjs:142 — done when test Y passes."
}
```

Be terse. `issues[].msg` ≤ 12 words. `rewrite` ≤ 40 words.
