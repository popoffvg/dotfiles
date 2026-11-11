# Worked case: the rollout machine, 12 states to 4

An installer deploys cloud stages one at a time. A record in a versioned store holds the run identity, the owner, a Run Lease, and a per-stage marker. A TUI that restarts finds a held record and rejoins the run with no key press. The operator reviewed the Quint model with line comments. The table lists each comment and the rule it gave.

| Operator's comment | What changed | Rule |
| --- | --- | --- |
| "We think in terms of restoring. What will I see after restoring state" · "We should remove that state at all" (on `Recording`) | `Recording` became the engine step `Claiming` between `GetRun` and `SaveRun` | The restore test |
| "you don't need a flag. There is no difference in behavior" (on `Observing`) | `Observing` became the derived predicate `drives(t, i, me)`, computed at each step | One state per behavior |
| "here we take into account rollout time" (on `Refused`) | The refusal asks `ownerIsLive` as well as `record.held` | Every block considers time |
| "why do you need kept? rename it first" · "what unresolved means?" | `Kept` → `Unresolved`, then deleted | Names |
| "and why I see Unresolved, we should drop it and resolve somehow" | Each reason got a resolution: re-describe, wait on the lease, re-read the record, read a bad marker as no marker | Every state resolves |
| "it should restore run status on the fly" | `networkDrop` sends the engine back to `Describing`, not to a terminal state | A lost observation is not an outcome |
| "polish quint naming. Remove unused in state enums terms" | Five renames; `LostProvider` and `NoReason` went when their behavior was fixed | Names · Enum terms |
| "now align go code with quint model as reference" · "and also emulate edgecases that quint highlighted in go too" | The Go machine went from 12 states to 4; the fake got `DescribeFailures`; the shipped bug got a mutation-checked test | The model is the reference |
| "rewrite function: signature should apply its own Option type, add option for blocking call: WaitUntil(condition)" | `ObserveExternalState` takes `ObserveOption[State]` and `WaitUntil`; a hand-rolled poll went away | Wait with a condition |

## Before and after

```
Go before                       Model and Go after
Idle, Recording               → gone; the save changes no state
Held                          → gone; deploy and rejoin both open at Deploying
Deploying, Observing          → Deploying
OutcomeReported, LeaseExpired → Clearing
Cleared, Ended                → Done, with result Success | Failure | NoRun
OutcomeUnknown, Starting      → gone; the machine reads again
Refused                       → Refused
```

```quint
type RolloutState = Deploying | Clearing | Done | Refused
type EngineStep = Claiming | Describing | Submitting | Watching | Waiting | Finishing
```

## What the model found in the code

- One failed `Describe` ended a running deploy. The observer had a budget of 360 attempts, but `nextStageRun` mapped each error to `stageRunUnreachable`, and the loop ended the stage on that kind. The kind had two meanings: a lost call and an unreadable state.
- The fake could not fail a describe, so no test reached that path.
- `InFlight` was a field of the state. After the collapse, a rollout that gave up is `Done` while its record is still held. The fact moved to the store side (`recordHeld`).
- `singleCreator` gave `[ok]` at 20 000 samples and a violation at 200 000. The earlier `[ok]` came from a search that did not go deep enough.
