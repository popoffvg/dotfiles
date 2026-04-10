# atom:pr

1. Discover repos:
   - if `go.work` exists, collect all `use ./path` directories
   - otherwise use cwd as the only repo
2. For each repo, check unpushed commits:
   - `git log @{u}..HEAD --oneline 2>/dev/null || git log HEAD --oneline`
3. Skip repos with no local commits ahead of upstream.
4. For qualifying repos, run `gh pr create` in each repo.
5. If PR already exists, print URL and skip creation.
6. Report a table: repo, branch, PR URL/status.
7. Append `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: Created PRs for <repos>`.
