# Quint models

<when="writing, changing, or reviewing a Quint model">

## Keep each model small

A small model is read in one pass, and its gaps show. A big model hides them behind its own layout. Example: the FS store folder walk was 480 lines in 15 files under the multi-file layout below. The same model in one file was 168 lines, and it gave the same results.

- A Quint model MUST answer one question, written in its first comment line: "Can a delete remove a folder that a running write needs?"
- A Quint model MUST start as one file: types, `const` switches, `var`s, pure defs, actions, `init`, `step`, invariants, witnesses, and the instance modules at the end. Aim for about 200 lines and at most 3 `var`s.
- A Quint model MUST state, in its head comment, the run command and the expected result (`ok` or `violation`) of each instance and invariant.
- A task that a small model cannot hold MUST split into several small models, one question each. Do not split one model into many files. Each small model replaces the other parts with a few `nondet` choices or a fixed assumption, and a comment names the source of that assumption (`file:line`, an ADR, or a measured fact).
- A Quint model MAY use the multi-file layout (sections A and B, the entry points, and the split by process) only when one question needs more than the budget and the operator agrees first.

## Shape the state as named collections

Use this shape when the model has more than one kind of thing, for example resources, files, and snapshot records. In a one-file model, each collection is one `var` with a comment that says where it lives and what a restore or a crash does to it; sections A and B apply only to a multi-file model. Section C applies to every model. Design the collections of the real system, not the rows. A collection is a set or a map that the system really keeps: a table in the DB, the files in a store, a queue in memory, the records in a bucket. Name each collection by the glossary term of the project. The links between collections become set relations, and each relation is one invariant.

A loose set such as `live` or `data` has no owner and no name a reader can look up. A missing collection is a missing concept. Example: "the workdirs that only an index task reads" became visible as `inputs(indexTasks) \ workdirs` only when `indexTasks` and `workdirs` were collections of their own.

### A. One module per collection

1. List the collections. For each one, write where it lives (DB, a store, memory, a bucket), its element type, and what a restore or a crash does to it. The place decides what a restore brings back, so it goes in the first line of the module.
2. Write one file per collection in `collections/`, named after the glossary term (see [Mark the entry points](#mark-the-entry-points)). The module owns one `var` with the same name, an `init`, a `write(v)` action, and the invariants that read only this collection:

   ```quint
   // Collection, in the work store: the files that exist. A restore does not bring it back.
   module workStore {
     import ids.* from "./ids"
     var workStore: Set[Res]
     action init = workStore' = Set()
     action write(v: Set[Res]): bool = workStore' = v
     // Local: only work-store ids.
     val onlyWork: bool = workStore.forall(r => isWork(r))
   }
   ```

3. Put the shared id types and the record types in modules with no `var` (`ids.qnt`, `snapshotRecord.qnt`), and import them with `.*`.
4. Use an enum only for a field that has exactly one value per element, for example the phase of a record. A fact that groups many elements is a collection, not an enum value.

Three Quint rules apply to this layout:

- Import each collection module qualified: `import workStore as WorkStore from "./collections/workStore"`. Every module has an `init` and a `write`, and a `.*` import makes them conflict.
- Give every `var` a unique name across all modules. A qualified import does not separate variables: two modules that each own `var files` fail with "Multiple updates of variable".
- Do not name an action, a parameter, or a `val` `put`, `next`, or `to`. They are built-in names.
- Put parentheses around a boolean expression on the right of `x' =`. Quint reads `x' = a or b` as `(x' = a) or b`: when `b` is true, the action runs with `x' = a`.

Done when every `var` lives in a collection module named after a glossary term, and the first line of each module says where the collection lives.

### B. The system module reads and writes every collection in one record

1. Declare a `State` record with one field per collection, and a `val now: State` that reads every collection var.
2. Write one `action commit(s: State)` that calls `write` on every collection. Every action is a guard on `now`, then `commit(<pure update of now>)`.
3. Write each update as a `pure def` on `State` (`gc(s)`, `writeFiles(s, rs)`). Tests read `now.<collection>`.

```quint
val now: State = { workStore: WorkStore::workStore, deletionQueue: DeletionQueue::deletionQueue, ... }
action commit(s: State): bool = all { WorkStore::write(s.workStore), DeletionQueue::write(s.deletionQueue), ... }
action executeDelete(r: Res): bool = all {
  now.deletionQueue.contains(r),
  not(deletionGuardrail),
  commit({ ...eraseFiles(now, Set(r)), deletionQueue: now.deletionQueue.exclude(Set(r)) }),
}
```

Done when no action assigns a `var` directly, and every action ends in `commit`.

### C. The relations between collections are the invariants

1. For each pair of collections that the system connects, write one relation: an inclusion, an empty intersection, or a key match. Name the invariant by the relation, and write the two collections in the comment above it:

   ```quint
   // DB → stores: every DB resource has its file, or waits for a rebuild.
   val dbResourcesHaveFiles: bool = dbResources(now).forall(r => hasFile(now, r) or now.rebuild.contains(r))
   // Deletion queue → DB and index tasks: nothing that the DB or an index task needs is queued for deletion.
   val deletionQueueNeedsNothing: bool =
     now.deletionQueue.forall(r => not(dbResources(now).contains(r)) and not(inputs(now.indexTasks).contains(r)))
   ```

2. Make a table in the test document: one row per relation, with the two collections and the meaning. Every collection appears in at least one row. A collection with no row is not checked.
3. Group `allInvariants` in two parts: inside one collection, and between collections.

Done when every collection is in at least one relation, and every relation is in `allInvariants`.

## Mark the entry points

A one-file model needs none of this section: its instance modules sit at the end of the file, and its head comment lists the runs and the expected results. This section applies to a multi-file model.

Quint has no `main` file. A reader of a model folder cannot tell which file runs and which file is a library. Make the layout tell it:

1. Keep only the entry points and the system modules at the top of the model folder. An entry point is a file with instance modules that `quint run --main` or `quint test --main` takes.
2. Move every library module to a subfolder, for example `collections/`. A library module has no instance module: a collection, a shared type. Import it by the subfolder path, also from the test files.
3. Name the test model `README.md` in the model folder. Start it with an `## Entry points` table: the file, the `--main` modules, what each checks, and the expected result. Link each file.
4. Add `check.sh` next to it. It holds one row per run: the file, the module, the kind (`test` or `run`), and the expected result (`pass` or `violation`). A module with a fix turned off expects `violation`. The script runs each row, prints `ok` or `FAIL`, and exits non-zero on any `FAIL`. It takes the trace count as an argument.
5. Make `check.sh` typecheck every file before the first row. `quint run` exits non-zero on a parse error too, so a broken file passes a row that expects `violation`.
6. Put the command `./check.sh` in the "How it runs" part of the README.

Done when `ls` of the model folder shows only entry points, system modules, `README.md`, and `check.sh`, and `./check.sh` prints no `FAIL`.

## Split the system module by process

First split the task into smaller models (see [Keep each model small](#keep-each-model-small)). Use this section only for a multi-file model that the operator agreed to. A system module of more than about 300 lines is too long to read in one pass. Split it into one file per process of the real system, for example `create.qnt`, `controllers.qnt`, `housekeeper.qnt`, `restore.qnt`, `crashAndStart.qnt`, and one file each for the invariants and the witnesses.

1. Put `State`, `now`, `commit`, and the pure reads and updates that more than one process uses in `system.qnt`. Each process file imports it with `import system.* from "./system"`.
2. Give no process file a `const`. An instance (`import m(C = v).* from "./m"`) gets its own copy of every `var` that `m` declares or imports. A process file with a `const` then writes other variables than the entry module, and `quint run` fails with `QNT502: Variable v not set`. A plain import of one module from many files shares its variables.
3. Make the rule switches and the bounds state. Add one record type for the switches and one for the bounds, and one collection module for each, with a `write` and no `init`. The entry module keeps the `const` declarations and writes them into the state in `init`. A process reads `now.ruleSwitches.TASK_GUARD`, or `s.ruleSwitches.TASK_GUARD` in a pure def on `State`.
4. Name the entry module `main` in `main.qnt`. It holds the `const` declarations, `initial`, `init`, and `step`, and nothing else. It imports every process file and `export`s it. Without `export`, a file that instances `main` does not see the actions of the process files.
5. Start `main.qnt` with a comment of at most four lines: "Start reading here", then the order in which to read the process files. `main.qnt` is where a reader starts, so it must fit on one screen with the comments of `step`.
6. Put the instance modules in their own entry file, for example `forks.qnt`. Each one is `import main(<switches>, <bounds>).* from "./main"`. The test files import `main` the same way.
7. Put a table in the README: one row per file, with what it holds. Put `main.qnt` in the first row, and say "Start reading at `main.qnt`".

Done when no process file has a `const`, `main.qnt` holds no instance module, every file typechecks alone, and `./check.sh` prints the same results as before the split.

## Comment the branches of `step`

`step` is where a reader learns what can happen next, so it carries the comments that the rest of the model does not need:

1. One line above `step`: what one step does, and what keeps the steps of a process in order (the guards of each action).
2. One comment per `nondet`: what the value is.
3. One comment per branch of the outer `any`: its number (`Branch 1 of 6`) and what it moves. A branch listed two times gets about two shares of the choice, so say why it is listed two times.
4. One comment per line of a grouped branch: the kind of work on that line.
5. One line above each `*Advance` action: what its next step is.

## Check that the model can fail

A model checks only the states that its shape allows. An abstraction that makes a bad state impossible hides the gap from every invariant and every random run. A green `quint run` proves nothing until steps 1 to 6 pass. Step 7 tests the invariants themselves; run it when the model gates a design decision.

1. **Prove each safe abstraction from the source.** A safe abstraction is a guard, an atomic step, or a reference that protects state, and also each failure or interleaving the model leaves out. Cite the `file:line` that does it in the real system. If no line does it, change the model to the weaker behavior. If the source is not available, ask for it, and do not trust the model. Example: "an index task keeps its input workdir as a DB reference" had no source line, and the real system does not do it.
2. **Cover every state component with an invariant.** Make a table: each `var` and each record field against the invariants that can fail on it. A read that cannot fail is not coverage. Write a new invariant for each empty row. Example: every invariant read `db.live`, and none read `db.tasks`, so a lost task input was invisible.
3. **Exempt the states where the loss is by design.** Do this before step 4. Write the exemption as a guard in the invariant. Example: workdirs after their hold ends. An invariant without the exemption fails on correct behavior and hides the real failure.
4. **Turn each fix off, and see an invariant fail.** A fix is each mechanism that keeps a bad state away. Put each one behind a `const`, and run with the same trace budget once per fix turned off. If no invariant fails, write a `run` that tries to reach the bad state. If the `run` reaches it, the fix is redundant. If no action can reach it, the shape hides the gap: go back to step 1.
5. **Size the sample budget on a known violation.** `quint run` samples, so an `ok` holds only for its budget. Raise `--max-samples` until every expected violation of step 4 shows, and keep that budget for the `ok` rows. Write the budget next to each result. Example: 20,000 samples of 25 steps missed a 9-step race that 200,000 samples of 15 steps found. A rare race needs fewer `--max-steps` and more samples.
6. **Add a witness for each dangerous state.** Pass it to `quint run --witnesses`, which prints the share of traces that reach it. Example: "a ready dump holds a task in progress". At 0%, the runs never explored the case: raise `--max-steps` or fix the guard that blocks it.
7. **Test the invariants blind.** An invariant written after you know a gap tests the fix and does not find the gap. Copy the model, and remove one fix and its invariant. First confirm that the copy fails an invariant you wrote in step 2. Then give only the copy to a fresh agent, with the task "find a state the real system can reach that breaks safety". If the agent does not find the gap, your invariants are too weak: go back to step 2.

</when>
