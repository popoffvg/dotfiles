---
name: tell-me
description: Build a mental model of one thing for an operator who has no context, as a markdown file opened in their editor — where a task or bug stands, how a mechanism works (Terraform state, a cache), where code lives, what happens on one call, why a design is this way, or how it breaks. Use for "tell me where this stands", "how does X work", "explain it to me from zero", "I lost track, catch me up", or `/tell-me <thing>`. A file that asks the operator to decide is `to-user`. A topic too big for 400 words goes to `lessons` when the operator confirms.
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*), Bash(~/.claude/scripts/zed-edit-return.sh:*)
---

# tell-me

Host: !`~/.claude/scripts/open-file.sh --host`

**The reader has no context, and the question they ask picks the model.** "Where does it stand?" needs a gap. "How does it work?" needs a mechanism. One fixed template answers one of these questions and writes empty sections for the rest.

## Steps

1. **Pick the approach.** Match the operator's words to **Reader asks** in **Approaches**. Take one. Take a second only when the operator's words also match its Reader asks, and put the one that explains before the one that judges: "our Terraform state is broken" is Mechanism, then Failure. Done when each approach you took answers a question the operator asked.
2. **Read before you write.** Open every file the thing owns, its `git log` and `git status`, its notes in `.notes/`, and the chat. A fact you did not read goes under Not checked. When the repo has no such thing, say so in chat and write no file. Done when every claim rests on a source you read this session.
3. **Size the topic.** The file holds at most 400 words of prose; figures and tables do not count. The topic is big when it passes the **Big when** limit of an approach, or needs more than 400 words to answer the exit questions. For a big topic, ask with `AskUserQuestion`: **A — lessons** (recommended), a lesson series from the `lessons` skill, or **B — tell-me**, this file cut to 400 words, with the rest under Not covered. Draft the prose first, then count it; give the count and the word total in the question. On A, hand the work to `lessons` and stop. Done when the topic fits, or the operator chose.
4. **Write the file** in **Frame**, to the scratchpad unless the operator names a place, as `tell-me-<thing>.md`. Done when the body answers every exit question and the prose is at most 400 words.
5. **Open it.** When Host is `zed`, run `~/.claude/scripts/zed-edit-return.sh <file>` with Bash `run_in_background: true` and `dangerouslyDisableSandbox: true`. In any other host, run `~/.claude/scripts/open-file.sh <file>`. Do not wait for the tab to close. Done when you told the operator the path and the one-sentence answer. Arm no watch: the file asks nothing.

## Frame

Every file has these sections. The approach sections go in the middle. The reader stops after any section and still has a correct, smaller model.

```markdown
# <thing>: <the answer in one sentence>
For: <what the reader knows> · not for: <what the file does not teach>

## In one sentence
<what the thing is and why it exists — no symbol names>

## The rule
<the one fact that always holds: at most 3 nouns and 1 verb>

## It is not
- <a wrong model a reader brings from a nearby tool> — <the fact that breaks it>

## The parts
<one show-me figure: at most 7 boxes; each box says what the part does and its symbol or path; each arrow says what moves>

<approach sections>

## Check yourself
1. <exit question>
   <details><summary>Answer</summary><the answer, with the section that shows it></details>

<when a CLI exists: 1–3 commands to run now, each with the output that confirms the model>

## Not checked
- <what was not opened, run, or verified>

## Not covered
- <what was cut to fit the limit; only for a big topic>
```

- **The rule** comes before any detail, because every later section is a case of it. When you cannot write it in 3 nouns and 1 verb, read more before you write.
- **It is not** lists 1–3 wrong models. Take them from a nearby tool or from what the operator said. Omit the section when no wrong model is likely.
- Write the exit questions of the approach before the body; they go under Check yourself with the answers folded. A question the body does not answer is a gap: fix the body, or move the question to Not checked.
- Pick each figure with `show-me`. Use mermaid, because this is a file. Put each label inside its box or on its arrow, never in a list under the figure. A part the rest of the file never names again is cut.
- Gloss each term once, where the file first uses it: plain words first, the symbol after. Use the same name every time.
- Apply `i-have-adhd` to every section.

## Approaches

### Gap — the state of work in progress

- **Reader asks:** where does it stand? what is left?
- **Fits:** a task, a bug, a branch, a PR, a migration.
- **Sections:** `Should be vs is` — a table: Aspect | Should be | Is now | Gap, one row per aspect that differs, with the target from the spec, the TODO, or the description, in that order; with none, use the operator's words and write "no written target" in the column header. `Where it hurts` — the open problem or the next step; when nothing is open, one line that says so. `How it got here` — 3–5 events that explain a gap, each with a commit or a date.
- **Exit questions:** What is it for? What is wrong or next? Why is it in this state?
- **Big when:** more than 6 gap rows.

### Mechanism — how a thing works

- **Reader asks:** how does it work? what does it do when …?
- **Fits:** Terraform state, a cache, a sync loop, a lock, a token refresh.
- **Sections:** `How it works` — a state diagram or pseudocode, one step per line, with `path:line` where this repo has the step. `One example` — one input walked through the steps to its result, chosen so it hits the step readers get wrong. Show the real artifact before and after the step that changes it: the state file, the row, the payload. `Rules that bite` — a table: Rule | What breaks if you forget it.
- **Exit questions:** What goes in and what comes out? Which step decides the result? What breaks if you forget the main rule?
- **Big when:** more than 7 steps or 7 rules.

### Map — where things live

- **Reader asks:** what is in it? where is X?
- **Fits:** a repo, a service, a module, a config tree.
- **Sections:** `Owners` — a shallow file tree or a component tree, one comment per entry that says what it owns. `Where to start` — the entry point and the first file to open for the 2–3 most common jobs.
- **Exit questions:** Which part owns X? Where does a change of kind Y go? Where do I start reading?
- **Big when:** more than 7 owners at the top level.

### Trace — one trip end to end

- **Reader asks:** what happens when X? where does the call go?
- **Fits:** a request, a deploy, a CI run, a message through a queue.
- **Sections:** `One trip` — a sequence diagram of one real run, each arrow named as the code names it. `Where it can stop` — a table: Hop | It stops when | What you see.
- **Exit questions:** Which hops does it pass? Where does it change state? Where can it stop, and how do you see that?
- **Big when:** more than 10 hops.

### Reasons — why it is this way

- **Reader asks:** why is it built like this? why not X?
- **Fits:** an odd design, a workaround, a pinned version, a rule that looks wrong.
- **Sections:** `The choice` — the constraint that forced it, with its source. `Options it beat` — a table: Option | Why not. `What would change it` — the fact that, if it changes, reopens the choice.
- **Exit questions:** What forced this? Why not the obvious option? What fact would reopen it?
- **Big when:** more than 4 options or more than 2 constraints.

### Failure — how it breaks

- **Reader asks:** why does it fail? what do I do when it breaks?
- **Fits:** a flaky test, an incident, a drift, an error that comes back.
- **Sections:** `Failure modes` — a decision table: Symptom | Cause | How to confirm | How to recover. `The one to know` — the most frequent mode, walked through with the evidence from this repo.
- **Exit questions:** Which symptom points to which cause? How do you confirm it? How do you recover?
- **Big when:** more than 6 modes.

### Contrast — the difference from a thing the reader knows

- **Reader asks:** how is it different from X?
- **Fits:** the operator names a tool or a module they know, or the thing is a variant of one.
- **Sections:** `Same as X` — one line. `Different from X` — a table: Aspect | X | This. `The trap` — the habit from X that gives a wrong result here.
- **Exit questions:** What carries over from X? What does not? Which habit from X breaks here?
- **Big when:** more than 6 differences.
