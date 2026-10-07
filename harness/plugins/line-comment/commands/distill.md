---
allowed-tools: Read, Write, Edit, Glob, Skill, Monitor, Bash(ls:*), Bash(mkdir:*), Bash(mv:*), Bash(~/.claude/scripts/open-file.sh:*), Bash(~/.claude/scripts/zed-edit-return.sh:*), Bash(~/.claude/scripts/watch-answers.sh:*)
description: Distill the pattern candidates that /line-comment:act saved into global review rules in ~/.notes/rules/, after the operator approves each rule
---

A **candidate** is one file in `~/.notes/patterns/`, written by the `pattern-triage` agent of `/line-comment:act` (shape in `act.md` § Triage pattern candidates). A **rule** is one `# ` section in `~/.notes/rules/<topic>.md`, which the wm review `rules` gate checks every diff against.

## 1. Read the candidates

Read every `~/.notes/patterns/*.md` (not the `distilled/` and `rejected/` subfolders). With no file or no folder, say so in one line and stop.

## 2. Group them into proposed rules

- Candidates with the same technique for the same kind of problem are one proposed rule. Merge by meaning, not by the `rule:` text.
- Read every `~/.notes/rules/*.md`. A habit an existing rule already states is a proposal to add the candidates as `Fail:` lines to that rule, not a second rule. Its other lines stay.
- Pick the target file by topic (`go.md`, `names.md`, …). Only when no file fits, propose a new `<topic>.md` whose frontmatter copies the shape of its neighbours.
- Write each new rule in the shape of the rules files: `# <title>` naming the defect, one paragraph that says what to check in the hunks, `Fail:` from the candidates' code lines, `Pass:` and `Edit:` written from the comment text, because a candidate holds only the code that failed.

## 3. Get approval

Hand the proposals over with the `to-user` skill, in a file `~/.notes/patterns/distill-<YYYYMMDD>.md`. One `[decide]` block per proposed rule: the candidates it comes from (`at:` and comment text), the target file, and the rule text in full. Options: A — accept, B — accept with the edits written in the slot, C — reject. Recommend A; recommend B with a narrower text when the rule names a technique or a kind of problem that no candidate shows.

Every rule goes to the global `~/.notes/rules/`. The operator moves a rule to a project rules folder by hand.

## 4. Write the accepted rules

This step starts when the operator closes the file or says the answers are done, as `to-user` and `check-answers` run it. Run `mkdir -p ~/.notes/patterns/distilled ~/.notes/patterns/rejected` first. For each A, and for each B with the slot edits applied and no second round, write the rule at the end of its target file. Move its candidates to `~/.notes/patterns/distilled/`. For each C, move its candidates to `~/.notes/patterns/rejected/`, so no later run proposes them again. A block with an empty slot counts as A. Delete the approval file.

Then print one line per proposal and **nothing else**:

```
<target file> — <rule title> — <accepted | accepted with edits | rejected> (<N> candidates)
```
