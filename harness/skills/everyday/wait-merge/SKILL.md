---
name: wait-merge
description: Drive one PR to merge. Check that it can merge, ask the operator about each blocker, then fix red CI without questions until the PR merges.
argument-hint: "[<pr-number> | <pr-url>]"
disable-model-invocation: true
---

# Wait for the merge

A **merge blocker** is a state that only a person can clear: a merge conflict, a draft, requested changes, a missing approval, an open review thread, or a branch protection rule. Red CI is not a merge blocker. This skill fixes red CI.

## Steps

1. **Read the PR.** Take the number or the URL from the arguments. Without an argument, use the PR of the current branch; when the branch has no PR, report that and stop. Take `<owner>/<repo>` from the PR URL, not from the checkout. Run:

   ```sh
   gh pr view <pr> --json number,url,state,isDraft,mergeable,mergeStateStatus,reviewDecision,headRefName,statusCheckRollup
   gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved isOutdated path line comments(last:1){nodes{author{login} body}}}}}}}' -F o=<owner> -F r=<repo> -F n=<number>
   ```

   When `state` is `MERGED` or `CLOSED`, report it and stop. When `mergeable` is `UNKNOWN`, GitHub still computes it: run the first command again after 10 seconds, at most 3 times, then report and stop. Done when `mergeable` is `MERGEABLE` or `CONFLICTING`.

2. **List the merge blockers.** Each row is one blocker:

   | Field | Value | Blocker |
   |---|---|---|
   | `mergeable` or `mergeStateStatus` | `CONFLICTING` or `DIRTY` | `merge-conflict` with the base |
   | `isDraft` | `true` | `draft-pr` |
   | `reviewDecision` | `CHANGES_REQUESTED` | `changes-requested` |
   | `reviewDecision` | `REVIEW_REQUIRED` | `approval-missing` |
   | review thread | `isResolved: false`, `isOutdated: false` | `open-thread` at `path:line` |
   | `mergeStateStatus` | `BLOCKED` with every check green and no row above | `protection-rule` |

   Pending or red CI is not a blocker. `BEHIND` is not a blocker: step 4 updates the branch. Done when every row is checked.

3. **Ask about the blockers.** When the list is not empty, show each blocker as one line: the slug, the evidence, and the action you recommend. Ask with `AskUserQuestion`, one question per blocker, the recommended action first, and `wait for the reviewer` as an option for `changes-requested`, `approval-missing`, and `open-thread`. Do the answered actions. Never resolve a conflict, reply to a reviewer, or mark the PR ready without an answer. A blocker answered with `wait for the reviewer` stays open and does not stop step 4. Done when every blocker is cleared or answered with `wait for the reviewer`.

4. **Set the goal.** Write this line as text, with the PR URL:

   /goal <pr-url> is merged, or a new merge blocker waits for the operator, or a CI failure needs the operator

   Do not ask the operator anything until one of those three holds. Turn on the merge on green with `gh pr merge <pr> --auto` and the first method the repo allows, in this order: `--squash`, `--merge`, `--rebase` (`gh repo view <owner>/<repo> --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed`). When `--auto` fails because the repo has no auto-merge, merge in step 6. When `mergeStateStatus` is `BEHIND`, update the branch: on a branch that `gs log short` lists, run `gs upstack restack` and `gs upstack submit`; else run `gh pr update-branch <pr>`. Done when the goal line is written and auto-merge is on or step 6 owns the merge.

5. **Fix the red CI.** Watch the required checks in the background until none is pending: `gh pr checks <pr> --required --watch`. For each failed required check:
   1. Read the failed log: `gh run view <run-id> --log-failed`.
   2. Decide the cause from the log: the change, a flaky test, or the CI setup. A flaky test passes on `gh run rerun <run-id> --failed` with no code change. Rerun each check at most once per PR.
   3. Fix the cause in the code, not the test, unless the test is wrong. Never skip, disable, or delete a test to make CI green. A CI setup cause outside the repo (a runner, a secret, a service) needs the operator: report it and stop.
   4. Run the repo linter and the tests of the changed packages locally, then commit and push. Follow the Push rules of the global instructions.

   Fix every failure of one watch in one push. After each push, go to step 1: a push can add a conflict or dismiss an approval. A new merge blocker goes to step 3. When the same check fails after two fix pushes, report the log and your two fixes, and stop. Done when every required check is green.

6. **Merge.** When step 4 left the merge to this step, run `gh pr merge <pr>` with the method of step 4. Watch `gh pr view <pr> --json state,mergeStateStatus` every 60 seconds for up to 30 minutes. When it is still open after that, report the state (for example a merge queue or a waiting review) and stop. Done when the state is `MERGED`.

Report `<owner>/<repo>#N` merged, or what stopped it, and one line per CI fix with its commit and the cause it fixed.
