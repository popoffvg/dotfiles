---
name: delivered-features
description: Write the report of features the operator delivered at MiLaboratories over a period, from their commits, with the business and user impact taken from the customer-ssot and product repos. Use for "what did I deliver since <date>", "list of delivered features", "features I shipped this quarter", "performance review list", or `/delivered-features <since-date>`.
argument-hint: "<since YYYY-MM-DD> [repo...]  (named repos replace the default list)"
---

# Delivered features report

The report lists features, not commits. Each feature has three parts: what it does for a user, which customers need it, and which product goal it serves. A reader with no engineering context must understand each line.

## Sources

| Repo | Where | Notes |
|---|---|---|
| pl | `~/Documents/git/mil/pl` | |
| platforma | `~/Documents/git/mil/platforma` | |
| text | `~/Documents/git/mil/mil-text` | Specs and design notes. Remote is `milaboratory/text`. |
| mictx | `~/Documents/git/mil/mictx-helper` | |
| desktop | `gh:milaboratory/platforma-desktop-app` | Not `platforma-desktop-v2`: that clone has no commits by the operator. |
| AVD | `gh:platforma-open/antibody-variant-designer` | The local clones under `mil/tasks/` are broken worktrees from another machine. |
| customer-ssot | `--context milaboratory/customer-ssot` | Read `README.md` and `definitions/model.md` first. |
| product | `--context milaboratory/product` | Product catalogue and briefs. No item has a "shipped" status. |

## Steps

1. Collect the commits and the context repos into the scratchpad:

   ```sh
   ~/.claude/scripts/delivered-features-sources.sh --since <date> --out <scratchpad>/df --gh-user vgpopov \
     --context milaboratory/customer-ssot --context milaboratory/product \
     ~/Documents/git/mil/pl ~/Documents/git/mil/platforma ~/Documents/git/mil/mil-text ~/Documents/git/mil/mictx-helper \
     gh:milaboratory/platforma-desktop-app gh:platforma-open/antibody-variant-designer
   ```

   `<scratchpad>` is the session scratchpad. The default `--author` regex `popo` matches both of the operator's emails (`popoffvg@`, `vpopov@`).

   Rows from `gh:` repos come from the default branch only, so their `on_main` is always `yes`.

2. Group the commits into features. Use the ticket id (`MILAB-NNNN`) in the subject first, then the subject topic. Commits named `MILAB-XXXX` have no ticket; group them by topic. A fix goes into the feature it fixes. Drop CI retriggers, dependency bumps and repo chores. Pure refactors go under "Smaller platform work" only when they change behavior. Mark each feature as design, implementation, or both. A spec commit in text (`spec(...)` or a ticket folder) counts as design.

3. Keep only features with commits on main. Drop branch-only work unless the operator names it; that named work stays and is marked "is on a branch". A squash-merged PR shows as `no`, so grep `git log origin/main` for the ticket id or topic of each `no` group before you drop it.

4. Find the impact. Start two `Explore` agents at the same time, one per context repo. Give each agent the path `<out>/context/<repo>`, and the feature list with one plain sentence per feature. Ask for a table: account or spec item, need or impact, status and date, file path.

5. Check every deal value and every "it fixed X" claim. Read the file the agent cites.

6. Write the report. One H2 per feature, the largest impact first, with "design", "implementation" or both in the heading. Under it: what it does, customers, product. Leave out a part that has no record. Write no file names and no commit subjects. Write "is on main" or "is on a branch", not "merged". At the end, add notes for what is not sure:
   - A customer record names a feature, never a commit. Write that a feature matches a customer problem when the record does not say the feature fixed it.
   - Name each feature for which no record was found.

7. Save the report to `~/Documents/git/mil/reports/delivered-features-<since>-to-<today>.md`. Dates are `YYYY-MM-DD`. Reply with the path and the feature headings only.
