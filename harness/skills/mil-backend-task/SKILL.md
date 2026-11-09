---
name: mil-backend-task
description: Find the operator's Notion task for one piece of work in the current Backend sprint of MiLaboratories, or create it with the fixed set of fields after the operator confirms. Use when another skill (for example `daily`) needs a task for a work item, or for "find my task for X", "create a backend task", "add a task to the current sprint", "is there a MILAB ticket for this".
argument-hint: "<what was done> [MILAB-N]"
---

# Backend task in Notion

A **task** is a row of the Tasks data source. Its id is `MILAB-<N>`, where `N` is the `userDefined:ID` column. A **sprint** is a row of the Sprints data source. A Backend sprint is named `Backend <YYYY-MM-DD>`, the date of its first day.

| Thing | Value |
|---|---|
| Tasks data source | `collection://1233a83f-f4af-814a-82dc-000b6e6d48db` |
| Sprints data source | `collection://1233a83f-f4af-8093-8cf5-000b679b2e7b` |
| Backend team page | `https://app.notion.com/p/1a43a83ff4af80d0aa13cb2cd8a941f7` |

The Notion tools are deferred. Load `notion-query-data-sources`, `notion-fetch`, `notion-get-self`, and `notion-create-pages` with ToolSearch first.

## Steps

1. **Find the current sprint by its name.** The current sprint is the Backend sprint with the latest name date on or before today. Do not read the `Status` or `Sprint status` field: it is not kept up to date. Run this SQL with `params: [<today>]`:

   ```sql
   SELECT url, Name FROM "collection://1233a83f-f4af-8093-8cf5-000b679b2e7b"
   WHERE Name LIKE 'Backend 20%' AND substr(Name, 9, 10) <= ?
   ORDER BY Name DESC LIMIT 1
   ```

   Done when you have one sprint url and name.
2. **Find the task.** When the work has a `MILAB-N` id (from the cwd, the branch, a commit, or a prompt), select the row with `"userDefined:ID" = N` in any sprint. Else list the tasks of the current sprint (`WHERE Sprint LIKE '%<sprint page id>%'`, where the page id is the last 32 hex characters of the sprint url) with `url, Title, Status, Assignee, "userDefined:ID"`, and match the work to a title by its key words (a symbol, a block, a feature name). Prefer a task whose `Assignee` holds the operator (`notion-get-self`). When several tasks match, offer them in step 3. Done when you have one task, or you know that no task matches.
3. **Ask before you create.** When no task matches, show the operator the row of step 4 with the values you propose, and ask: create it, use another task (the operator gives a `MILAB-N` or a url; look it up as in step 2), or skip. Ask the operator for the estimate (`Story Points`) of each row; propose none. The operator can change any proposed value. When the caller gives several works, show all proposed rows in one question and take one answer per row. Create nothing without a yes. On a skip, return no task. Done when the operator answers.
4. **Create the task with the fixed fields.** Call `notion-create-pages` with `parent: {data_source_id: <the Tasks data source id, without "collection://">}`. Fill every field of this table, and no other field:

   | Field | Value |
   |---|---|
   | `Title` | `[<area>] <result in plain words>`. The area is the repo or the part: `backend`, `pl`, `desktop`, `sdk`, `ml`, `infra`, `ci`, `support`. |
   | `Team` | `["<Backend team page>"]` |
   | `Sprint` | `["<current sprint url>"]` |
   | `Assignee` | `["<operator user id>"]` from `notion-get-self` |
   | `Status` | `Done` when the PR is merged or the work is finished, `In Review` when a PR is open, else `In Progress`. |
   | `Category` | `Bug` for a fix of wrong behavior, else `Task`. |
   | `Priority` | `Medium` |
   | `Story Points` | The operator's estimate from step 3, as a number. |

   Set `content` to the body of the Tasks template, with the text filled:

   ```
   # Description

   <what changed and why, 1-3 sentences, with the PR link `https://github.com/milaboratory/<repo>/pull/<number>`>

   # Acceptance Criteria

   - [ ] <one check a reviewer can do>
   ```

   Done when the page exists.
5. **Return the task.** Fetch the page and read `userDefined:ID`. Return `MILAB-<N>`, the url, and the title. Done when the caller has the three values.
