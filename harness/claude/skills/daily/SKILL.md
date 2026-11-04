---
name: daily
description: Write the daily done-of-day report for the operator's boss — what the operator did today in one org — from today's Claude Code sessions, one line per result with its Notion task. Use for "daily", "what did I do today", "write my standup", "daily report for mil", or `/daily <org> [YYYY-MM-DD]`.
argument-hint: "<org> [YYYY-MM-DD]"
---

# Daily report

An **org** is a folder `~/git/<org>/` — for example `mil` holds every project of the mil org. A session belongs to the org when its working directory lies under that folder.

## Steps

1. **Get the org.** The org is REQUIRED. Take it from the arguments. When it is missing, ask for it — list the folders in `~/git/` as options — and stop until the operator answers. Never guess the org from the current directory. Done when you have one org name.
2. **Collect the sessions.** Run `~/.claude/scripts/daily-sessions.py <org> [--date YYYY-MM-DD]` (default date is today). When it exits with "no org folder", show the folder list it prints and ask again. When it prints `sessions=0`, say so and stop. Done when you have the digest.
3. **Write one line per result.** Read the whole digest. Merge sessions by the `MILAB-N` id first, then by the PR, then by topic; one session can give several results. Count the PRs the operator reviewed on one line: "Reviewed N pull requests". `U:` lines say what the operator asked, `X:` lines show commits, PRs, and tickets, `T:` lists the `MILAB-N` ids the session touched, and `A:` is the last state. Apply the line rule below. Done when each result is one line.
4. **Link each line to its task.** For the org `mil`, follow the `mil-backend-task` skill with all the lines at once, each with the `T:` ids of its sessions. For another org, skip this step. Done when each line has a task or the operator skipped it.
5. **Write the report** in the format below and print it in chat in one code block. Write nothing to disk unless the operator asks.

## The line rule

The boss knows the product, the repos, and the people. Write each line as one result in the past tense, in at most about 15 words: what changed and where, for example "Fixed FieldExists not counting as a tracked read, so it didn't conflict with concurrent transactions". A repo, PR, block, flag, or API name the team knows can stay. A line can say what blocked the day, for example "Fought CI all afternoon: CI not triggering, rebases, GitHub Actions outage".

Drop the files, the tests, the linters, commits to `.notes`, internal ids such as TODO numbers and commit hashes, work on skills, agents, prompts, and the harness unless it is committed to an org repo, and tooling noise such as retries and questions about the agent. When the digest does not show an outcome, write the last known state, for example "Started …", and never invent one.

## Format

The operator pastes the report into the Slack message box, which turns pasted `- ` lines into a list. Print one flat list, with no headings and no groups, inside one fenced code block, so the operator copies it with `/copy`. Put the reviews first, then the other lines in the order of the day.

Each line is `- <result> (<PR>) — <MILAB-N> <task url>`. Leave out `(<PR>)` when the line has no PR, and the task part when the line has no task. Write a PR as `<repo>#<number>` with the short repo name (`pl#2358`). In the result text, escape `&`, `<`, `>` as `&amp;`, `&lt;`, `&gt;`. Never use `◦`, `•`, or `:black_small_square:` as a bullet: Slack shows them as text.

Example:

```
- Reviewed 8 pull requests
- Fixed FieldExists not counting as a tracked read, so it didn't conflict with concurrent transactions (pl#2358) — MILAB-7301 https://app.notion.com/p/4093a83ff4af80cfb431ff30a13f30e2
- Made instance stats in ML and desktop work only when instanceStats:v1 is advertised — MILAB-7288 https://app.notion.com/p/40e3a83ff4af80faa062c3ef67b261ec
- Fought CI all afternoon: CI not triggering, rebases, GitHub Actions outage
```
