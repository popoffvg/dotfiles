# impl skill

## Rule: a rule that depends on `approve` or `risk` lives in a ruleset file

`commands/sub-impl.md` holds only the steps that are the same under every ruleset. Where a step changes with a key, it says "as the ruleset says" and nothing more. The change itself is a line in `rulesets/approve-<value>.md` or `rulesets/risk-<color>.md`.

`bin/impl-ruleset.py` resolves both keys for one TODO and prints the two matching files. The session never resolves the keys by hand.

**The identity-branch test.** A sentence in `sub-impl.md` that starts "Under `approve: todo`…" or "When the TODO is `risk: red`…" is a ruleset line in the wrong file. Move it to the ruleset file; leave "as the ruleset says" at the step.

**To add a value:** add the ruleset file, add the value to `APPROVE_VALUES` or `RISK_VALUES` in `bin/impl-ruleset.py`, and add it to `arch:ref-write.md` § Approval or the `risk` table in `arch:examples/todo.md`. Edit no step in `sub-impl.md`.

**Each ruleset file is complete.** Two files may repeat a line (`approve-todo.md` and `approve-none.md` share the implementer line). The session reads one approve file, never two, so a shared line is not a duplicate it reads twice.
