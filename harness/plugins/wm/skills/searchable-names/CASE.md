# Why the naming rules left CODE_STYLE.md

Four findings from the sessions under `~/.claude/projects/-Users-vitaliipopov-git-dotfiles/`,
2026-08-31. Each is a way the rules failed to reach the moment they were written for.

## The one import that carries them is broken

`~/.claude/CLAUDE.md` ends with two imports. `@RTK.md` resolves — `~/.claude/RTK.md` is a stow
symlink and its text appears in every session's context. `@CODE_STYLE.md` resolves to nothing:
there is no `~/.claude/CODE_STYLE.md`, because the file is stowed to
`~/.claude/output-styles/CODE_STYLE.md` instead. The import fails silently and the text never
appears.

RTK is the positive control. Two imports, same file, one loads and one does not — so the absence is
the path, not the import mechanism.

## So nothing loaded them

`CODE_STYLE` appears zero times in most of the last 25 transcripts. Where it appears, a subagent
prompt put it there. The only remaining path in is a pointer — the `CODE` and `ADHD` output styles
each say "read `~/.claude/output-styles/CODE_STYLE.md` when writing code" — and a pointer fires only
when the model chooses to follow it.

A skill needs no pointer and no import. Its description is read at every turn.

## The rules were cited by a name they never had

Three files cited `CODE_STYLE.md § Domain module layout` as the home of "naming and module home for
every piece": `wm/INDEX.md`, `arch/SKILL.md`, and `arch/references/ref-bricks.md` twice. That section
does not exist and never did. The naming rules lived under § Align language and § Searchable names,
so a reader following any of the four citations found nothing and moved on.

## Two kinds of work were sharing one file

`pedant` already owned review-time naming — attack the names a finished diff declares. Write-time
naming sat in a code-style document beside comment prose and the table/reader rule. The 2026-08-31
`md-comment` → `line-comment` rename is the shape that falls between them: it is not a diff under
review, and it is not a comment. Nothing fired.

## What did not change

Comment prose (§ DO NOT DO) stayed in
`CODE_STYLE.md`. The `comment-critic` agent reads those three sections by name.

## How the dead import was settled

The operator dropped `@CODE_STYLE.md` from `~/.claude/CLAUDE.md` rather than repair it. Repairing it
would have loaded 72 lines of comment rules into every session, including sessions with no code in
them. Both halves of the old file now reach a session by a path that works: the naming half through
this skill's description, the comment half through the `CODE` and `ADHD` output styles, which say to
read `~/.claude/output-styles/CODE_STYLE.md` when writing code.

`@RTK.md` is the only import left in that file.

## The move alone does not fix the original problem

Measured the same day by `evals/run-names-live.sh`, 60 real sessions, three per case:
**`searchable-names` fired 0 times out of 33.** `pedant` — a mature skill nobody touched — fired 2 of
3 on its own bare word and **0 of 9** on every other naming-review task.

So the four findings above name a real fault, and being a skill does not cure it. A skill description
turns "the rules never load" into "the rules load sometimes", and the same one-word prompt fired in
one session and not the next.

**The lever is a hook, not a description.** `comment-check.mjs` already enforces the comment half of
`CODE_STYLE.md` from `PostToolUse` on `Write|Edit` — no model call, no choice, no always-on context
cost. The naming half has no equivalent. That is the missing parallel, and the skill stays the one
home for the rules a hook points at.
