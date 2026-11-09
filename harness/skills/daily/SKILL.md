---
name: daily
description: Write the daily done-of-day report for the operator's boss — what the operator did today in one org — from today's Claude Code sessions, as Slack-ready groups of results under their Notion tasks. Use for "daily", "what did I do today", "write my standup", "daily report for mil", or `/daily <org> [YYYY-MM-DD]`.
argument-hint: "<org> [YYYY-MM-DD]"
---

# Daily report

An **org** is a folder `~/git/<org>/` — for example `mil` holds every project of the mil org. A session belongs to the org when its working directory lies under that folder.

## Steps

1. **Get the org.** The org is REQUIRED. Take it from the arguments. When it is missing, ask for it — list the folders in `~/git/` as options — and stop until the operator answers. Never guess the org from the current directory. Done when you have one org name.
2. **Collect the sessions.** Run `~/.claude/scripts/daily-sessions.py <org> [--date YYYY-MM-DD]` (default date is today). When it exits with "no org folder", show the folder list it prints and ask again. When it prints `sessions=0`, say so and stop. Done when you have the digest.
3. **Write one line per result.** Read the whole digest. Merge sessions by the `MILAB-N` id first, then by the PR, then by topic; one session can give several results. A review of a PR is a line under the task of that PR; reviews with no task go on one line, "Reviewed N pull requests". `U:` lines say what the operator asked, `X:` lines show commits, PRs, and tickets, `T:` lists the `MILAB-N` ids the session touched, and `A:` is the last state. Apply the line rule below. Done when each result is one line.
4. **Link each line to its task.** For the org `mil`, follow the `mil-backend-task` skill with all the lines at once, each with the `T:` ids of its sessions. For another org, skip this step. Done when each line has a task or the operator skipped it.
5. **Write the report** in the format below and print it in chat in one code block. Write nothing to disk unless the operator asks.

## The line rule

The boss knows the product and the people, not the code. Write each line as one result in the past tense, in at most about 8 words: what the result gives, not how it works, for example "Fixed transactions missing a conflict". Never name a function, a type, an error code, or a client library. Merge the results of one task into at most 3 lines. A line can say what blocked the day, for example "Lost the afternoon to CI outages".

Drop the files, the tests, the linters, commits to `.notes`, internal ids such as TODO numbers and commit hashes, work on skills, agents, prompts, and the harness unless it is committed to an org repo, and tooling noise such as retries and questions about the agent. When the digest does not show an outcome, write the last known state, for example "Started …", and never invent one.

## Format

The operator pastes the report into the Slack message box, which turns `[text](url)` into a link. It also turns pasted `- ` lines into a list with an empty line above it, so start each result line with `• ` instead; Slack keeps it as text. Print the report inside one fenced code block, so the operator copies it with `/copy`.

Write one group per task, in the order of the day. A group starts with the header `[MILAB-N](<task url>): <task title>` on its own line, where the title is the Notion title without its leading `[area]` tag. Under it, with no empty line, write one `• <result>` line per result. When the PR of a line is open, end the line with ` [<repo>#<number>](<PR url>)`, with the short repo name; a merged or closed PR gets no link. Put the lines with no task in a last group with no header. Put a `———` line (three em dashes) between groups, with no empty line around it. Never use `---`: Slack reads the line above it as a heading and joins the group into one paragraph.

In the result text, escape `&`, `<`, `>` as `&amp;`, `&lt;`, `&gt;`.

Example:

```
[MILAB-7301](https://app.notion.com/p/4093a83ff4af80cfb431ff30a13f30e2): Tracked reads in transactions
• Fixed transactions missing a conflict [pl#2358](https://github.com/milaboratory/pl/pull/2358)
• Reviewed the follow-up PR from the backend team
———
• Reviewed 8 pull requests
• Lost the afternoon to CI outages
```
