# Golden words — one name for a form the house uses unchanged

A **golden word** is the name of a form the model already holds in full — *ASD-STE100*, *RFC 2119*, *Gherkin*. Written once, it stands for every convention of that form. A leading word (`text-style`) anchors one quality (*tight*, *red*); a golden word stands for a rule block. It is the first move when writing a new skill, and a pass of `prune-text` on an existing one.

The text takes one shape: `Write it as <golden word>.` — followed by the house rules the word does not cover, as plain rules.

## Scope

A golden word replaces **the part of a block the house keeps verbatim** from the public form. A rule where the house differs from the form stays a plain rule beside the word; it never becomes a "gotcha" under the word. Measured: a word primes the public form, and a house delta written under it loses in 4 of 5 runs, while the same delta without the word holds in 5 of 5. CLAUDE.md's "RFC 2119 keywords for obligations" is the pattern: the word for the public part, the house rule beside it.

## Verify on a real input

The word is golden only when the reader keeps the rules on a real input. A free sample proves nothing: the model invents a textbook case and recites the public form. Run two arms, three runs each, on the reader tier (the `model:` of every agent that loads the skill), with `claude -p --safe-mode --strict-mcp-config --tools ""` from an empty directory so nothing of the house leaks in:

- **word** — the task on one input from the skill's domain, with `Write it as <word>.`
- **no word** — the same task with the rules the word is meant to carry, written out, and no word.

Grade both arms against the house rule file, row by row. Delete a rule from the skill only when the word arm keeps it in 3 of 3 runs **and** the no-word arm does worse — otherwise the rules did the work, not the word, and the block keeps them. A word that fails on any rule is not golden for that block: keep the plain rules and drop the word.

`evals/run-golden-words.sh` at the plugin root runs this check from `evals/cases-golden-words.jsonl`. A skill that carries a golden word has a case there, so the check re-runs when a model alias moves (`model: sonnet` is an alias the platform moves; one such move flipped two defaults 0/3 → 3/3).

## Record

Each golden word has one row in the plugin's `GLOSSARY.md`: the word, the house rule file it stands for, the reader tier and the resolved model id it passed on, and the date. The skill body carries the word; the glossary carries the expansion, so a reader who does not hold the form can still check the skill against it.
