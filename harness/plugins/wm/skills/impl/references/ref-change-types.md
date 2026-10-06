# impl — change types

**The one roster of change kinds, used at three scales.** A TODO declares one in its `type:`
frontmatter, an increment declares one in its **Change** bullet, and each change in a shown diff
gets one row in the table above it. Same nine words each time, so the label the human approved at
`todo` is the label they read again in the diff.

| Scale | Where it is written | Owner |
|---|---|---|
| TODO | `TODO-N.md` frontmatter `type:` | `arch:examples/todo.md`, the frontmatter block |
| increment | `TODO-N.md` § Increments, the **Change** bullet | `arch:examples/todo.md` § Increments |
| shown diff | the table above the diff, one row per change | this file, below |

## The roster

A TODO or an increment carries exactly one kind — the one its **main** work is. Two kinds with equal
claim is the split signal: a TODO that is both `new behavior` and `wiring` is two ledger rows, and an
increment that is both is two increments.

The shown diff gets one row per change. A mixture is normal there: a `new behavior` change sits
beside the `wiring` and `call-site migration` changes that carry it. The subagent in `sub-impl.md`
step 5.3 assigns the kind: the first boundary below that holds.

| Kind | Inside the boundary | Stops before | How the human reads it |
|---|---|---|---|
| `generated` | A tool wrote the lines from other input | A person wrote the lines | check the tool regenerated it |
| `test` | The lines assert a case. They do not ship as the product | The lines run as the product | check the case is one of `TODO-N.test.md` § Autotest |
| `deletion` | The behavior is removed, and no other change still performs it | The behavior continues under a new name or in another unit | check that no caller is left |
| `rename` | Only the name changes. Place, contract, and decision stay | The contract, the decision, or the unit changes | check that nothing else changed with it |
| `move` | The same decision now lives in another unit. The decision stays | The decision itself changes, or the behavior is gone | check that nothing else changed with it |
| `signature change` | The declaration changes: a type, a parameter, or a return. The decision stays | A line uses the new shape to decide, compute, or store | line by line — it is the contract the increment's **Surface** diff fixed |
| `call-site migration` | A call keeps the meaning it already had after a contract moved | The call carries a value this layer did not have, or decides that value | count the calls against the increment's **Blast radius** |
| `wiring` | A value passes through. This layer does not decide it, compute it, or store it | This layer creates, chooses, or stores the value | check the value reaches the far end; skim the middle |
| `new behavior` | The lines decide, compute, or store something the repo did not do before | The lines only declare, forward, rename, move, delete, assert, or a tool wrote them | line by line — this is the change |

Walk top to bottom. The first boundary that holds is the kind.

A diff that fits no kind is a diff the increment did not predict. Stop and replan
(`sub-impl.md` step 4) instead of inventing a tenth kind.

## The table under `approve: increment`

Written by a subagent in `sub-impl.md` step 5.3, above the increment's `git diff`, one row per change.

**Say when the table has no `new behavior` and no `signature change` row.** An increment that is all
wiring, migration, rename, move, deletion, test, and generated changes is mechanical: tell the human
so, so the approval is one glance instead of one read.

## The start point under `approve: todo` and `approve: none`

The whole-TODO diff is too long to walk change by change. Show the same table, carrying every
`new behavior` and `signature change` row ordered outward from the start point along the calls, and
one final row counting the other kinds.

The **start point** is the deepest `new behavior` change, the one no other changed symbol calls.
The row carries `← start point`. It is the first change the human opens in the diff.

Under `approve: todo` this goes above the single `git diff` the user approves. Under `approve: none`
nobody approves anything, so it goes in the step 9 report instead — it is how a human who reads the
report later finds where the TODO actually changed the system.

## The shape of both tables

`examples/change-table.md` — the two tables filled, each column and each required line carrying its
own rules. Nothing on this page is copyable; open the example to write one.
