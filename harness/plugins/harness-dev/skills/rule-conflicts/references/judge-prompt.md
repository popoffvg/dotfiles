You judge instruction rules for contradictions. Work dir: `<OUT>`.

Input: these group files in `groups/`: `<FILES>`. Each file is `{"group": "<artifact> | <aspect>", "rules": [{"where": "<file>:<line>", "polarity": "require|forbid|limit", "text": "<rule sentence>"}]}`. The rules come from a coding agent's instruction corpus: a global CLAUDE.md, skills, and rule files. An embedding model made the groups, so a group can mix unrelated rules. A regex set the polarity, so it can be wrong.

Do these steps for each group.

1. **Normalize every rule.** Write it for yourself as `artifact | require/forbid/limit | condition | what`. The artifact is a general noun: a doc line, a docstring and a doc tag are all `code comment`. The condition is when the rule applies: `always`, `unless the user asks`, `only where the code needs it`, `in Go files`. Set the polarity from the meaning, not from the regex.
2. **Pair the rules on one artifact.** Compare every two rules whose artifact is the same, also two rules from one file.
3. **Test each pair with one situation.** Make up one concrete, ordinary situation in which both rules apply: "the agent adds an exported Go function and the user did not ask for comments". If obeying one rule in that situation breaks the other, the pair is `contradicts`. These shapes are `contradicts`:
   - require against forbid on the same artifact;
   - "every" or "always" against "only when …", "unless …", or "if the user asks", when the situation meets the first rule and not the condition of the second;
   - two limits that no single artifact can meet.
   If no ordinary situation breaks a rule, the pair does not conflict. A rule that is only stricter inside a narrower scope is not a conflict.
4. **Find duplicates.** Two rules in different files that say the same thing, with the same condition, are `duplicate`.
5. **Propose a fix.** For each pair, write the change that makes the corpus agree. Prefer the rule with the narrower scope when it was written for that scope; prefer the global CLAUDE.md for a general habit; for a duplicate, keep the rule in the file that owns the subject and point the other file at it.

Do not report a sentence that quotes another rule as a "Bad:" example, or a rule about a different artifact.

When a sentence is unclear, read 5 lines around its `<file>:<line>` (`~` is the home dir) before you decide. A `where` that starts `planted:` has no file; judge it by its text alone.

Write one JSON object per line to `judged/<BATCH>.jsonl` with keys `group`, `label`, `a_where`, `a_text`, `b_where`, `b_text`, `situation` (the one sentence from step 3; empty for a duplicate), `fix` (one sentence from step 5). Write an empty file when you find nothing. Return only the output path and the count of each label.
