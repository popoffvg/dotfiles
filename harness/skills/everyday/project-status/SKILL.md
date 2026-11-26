---
name: project-status
description: Write the status page of one project for a manager with little context — what is merged, what is planned with three merge estimates, PR counts, and what slows the project — as a published artifact with a timeline. Use for "status report for my manager", "project timeline for the boss", "update the status page", or `/project-status <task folder>`.
argument-hint: "<task folder> [artifact url]"
---

# Project status page

The reader is a manager. He knows the product and the people, not the code. The page shows the project only: never show harness, dotfiles, skill, or agent work, and never show a blocked PR.

The final view is [references/status-page.html](references/status-page.html). It is the snapshots page of MILAB-7260 on 2026-11-26. Copy it and change only the data: the header text, the six terms, the key numbers, the `ROWS` table, the issue cards, and the sources line. Keep the layout, the tokens, and the reader code.

## Steps

1. **Get the inputs.** The task folder is REQUIRED (for example `~/git/mil/tasks/MILAB-7260-instence-record`). Read its spec work plan, its PR chain file, and the TODO files of its notes. When an artifact url is given, read the artifact first and update it at that url. Done when you know the parts, their order, and the TODO of each part.
2. **Get the PR facts.** Run `gh api repos/<owner>/<repo>/pulls/<n>` for each PR of the project, outside the sandbox (the sandbox breaks the TLS of `gh`). The GraphQL search of `gh pr list` fails on a node limit: use the REST form. Collect the state, `created_at`, `merged_at`, `additions`. Done when each part has its merged PRs with dates and sizes.
3. **Get the operator time.** Run `~/.claude/scripts/operator-time.py --folder <task folder name> --branch '<ticket>/' --mention '<ticket>|<project word>' --since <start> --until <today>`. For time per TODO, run `~/.claude/scripts/task-activity.py <task folder name>`. Done when you have the project share of org work, the weekly share, and the operator hours per done TODO.
4. **Compute the three estimates.** See [Estimates](#estimates). Done when each planned row has `plan`, `planFocus`, and `planReview` dates.
5. **Fill the page and publish it.** Run the Artifact `quickstart` first, as the Artifact tool requires. Check the page script with `node --check` on the extracted `<script>` body. Publish, and give the link. Done when the link opens the page with today's data.

## Page content

| Block | Content |
|---|---|
| Header | Ticket, date, one plain paragraph: what the feature gives and what is wrong today. |
| Key numbers | PRs merged; PRs planned (estimate) with the percent done; the median added lines of a merged PR; phases with code in main; the merge range "full focus – with review waits". |
| Terms | Six terms in plain words, one sentence each. |
| Timeline | One row per work line. Merged bars in green from the first commit to the last merge. A red segment only for a measured review wait of a merged PR. Planned bars: dark to the full-focus date, light to the date with review waits. A dashed "Today" line. |
| Table | Work, what it gives, state, merged on, expected merge with full focus, with last month's focus, with review waits. |
| What slows the project | Review wait, CI failures not caused by the project, other work in parallel. Each card ends with one ask. |
| Sources | One line: GitHub PRs, the spec, the work log; say which sizes are estimates. |

Do not show: the share of harness or tooling time, the PR size without tests, a blocked or failing open PR, the per-row PR count or size.

## Estimates

Count working days only, Monday to Friday, in every estimate and every date. Day 0 is today.

- **Full focus:** a TODO takes the median days from its first commit to its PR open (2 days for MILAB-7260). A part starts on the day after the parts it depends on merge. Independent parts run in parallel.
- **Last month's focus:** the operator hours per TODO times the TODOs left, divided by last month's project hours per weekday, gives the end date. Stretch each full-focus date from today by the same factor. Name the other work that took the time, from the top other-work folders of step 3.
- **With review waits:** add to each last-month's-focus date the review delay of its part: the mean open-to-merge days of the merged PRs, once per part on the chain of dependencies before it.

Every number on the page MUST come from a command of steps 2 and 3 or a file of step 1. Label an estimate as an estimate.
