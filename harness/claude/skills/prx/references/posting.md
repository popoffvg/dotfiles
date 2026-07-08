# Posting a batched inline PR review

Goal: submit all collected comments as ONE review with inline threads.

## Parse the PR URL

`https://github.com/<owner>/<repo>/pull/<number>` → `owner`, `repo`, `pullNumber`.

## Get the head commit SHA

Inline comments attach to a commit. Use the PR head SHA.

- MCP: `pull_request_read` (method `get`) → read `head.sha`.
- CLI: `gh pr view <url> --json headRefOid -q .headRefOid`.

## Preferred: GitHub MCP pending-review flow

1. `pull_request_review_write` method `create` — open a pending review (owner, repo, pullNumber, commitID=headSha).
2. For each comment: `add_comment_to_pending_review` with `path`, `line`, `side` (RIGHT default, LEFT for removed lines), `body`, `subjectType: line`.
   - File-level / general comment (no line): collect its body and append to the review's summary `body` in step 3, prefixed with the path, e.g. `**foo.go**: <body>`.
3. `pull_request_review_write` method `submit_pending` — event `COMMENT`, `body` = summary (include any general notes gathered above).

If a per-line `add_comment_to_pending_review` fails because the line is not in the diff, drop that inline call and fold the comment into the summary body as general text; record it for the report.

## Fallback: `gh` CLI

For inline comments the CLI has no batching primitive; use the REST API per comment against a single review is not directly exposed. Simplest reliable fallback:

- Post each inline comment via REST:
  ```
  gh api -X POST /repos/<owner>/<repo>/pulls/<number>/comments \
    -f commit_id=<headSha> -f path=<path> -F line=<line> -f side=<SIDE> -f body=<body>
  ```
- Post general notes as a review body:
  ```
  gh pr review <url> --comment --body "<summary>"
  ```

(These appear as standalone comments rather than one pending-review batch — acceptable fallback when MCP is unavailable.)

## milaboratory org auth

`gh` API and `git`/`gh pr diff` on `milaboratory/*` need the work account:

```
gh auth switch --user vgpopov     # before org-repo gh calls
# ... run the gh commands ...
gh auth switch --user popoffvg    # restore personal default after
```

The GitHub MCP uses its own token — try MCP first; if it 404s on the org repo, use the `gh` fallback with the auth switch above.

For `gh pr diff` over an SSH remote that 404s ("Repository not found"), the SSH key auths as personal. Rewrite SSH→HTTPS for that one command:

```
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf \
  GIT_CONFIG_VALUE_0=git@github.com: gh pr diff <url>
```

## Error handling

- Line not in diff → 422 from REST / MCP error → fold into summary body, report as general.
- Missing PR URL → ask the user; never guess.
- Empty comments file → stop, tell the user nothing to post.
