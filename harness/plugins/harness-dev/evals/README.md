# harness-dev evals

| Runner | Cases | Grades |
|---|---|---|
| `run-golden-words.sh` | `cases-golden-words.jsonl` | Every **golden word** in `GLOSSARY.md`: does the bare word keep the house rules on a real input, on the reader tier, against a no-word arm that states the rules. |

## Why two arms

A free sample proves nothing: given no input the model recites the public form and invents a textbook case. Measured on this house: a rule the recital listed 5/5 broke 4/5 on a real diff, and a house delta written under the word broke 4/5 while the same delta without the word held 5/5. So a word earns its place only when the word arm keeps every rule in N/N runs; the no-word column beside it shows which rules the rules themselves carry.

## Run

```sh
./run-golden-words.sh              # all cases
./run-golden-words.sh -i <id>      # one case
./run-golden-words.sh -v           # print each judge verdict
RUNS=5 ./run-golden-words.sh       # runs per arm (default 3)
TIER=sonnet ./run-golden-words.sh  # override every case's reader tier
JUDGE=sonnet ./run-golden-words.sh # judge model (default opus)
```

Needs `claude` and `jq`. Every reader and judge run uses `--safe-mode --strict-mcp-config --tools ""` from an empty directory, so `~/.claude/CLAUDE.md` and the memory store stay out. Exit 0 = every word passes.

Re-run when a model alias moves; update the `Model id` and `Checked` columns of the word's `GLOSSARY.md` row from the result.

## Cases

`cases-golden-words.jsonl`: `id`, `word`, `tier` (the `model:` of the agent that loads the skill carrying the word), `task` (a real input from the skill's domain, with the instruction), `rules` (the house rules the word must carry, one checkable sentence each — the judge grades these and the no-word arm states them).

A skill that carries a golden word adds a case here in the same change.
