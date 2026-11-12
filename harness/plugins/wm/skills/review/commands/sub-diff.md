# review — diff

Judge a diff that no TODO pair covers: the working tree, a commit range, a branch against its base,
or a PR. The run is @../references/ref-reviewrules.md. This mode reports and stops: it runs no
fixup loop, because a human reads the report.

## Steps

1. **Resolve the target into a base and a head.** Say what you resolved:

   | The caller said | `--base` | Head |
   |---|---|---|
   | nothing | `HEAD`, with `--worktree` | the working tree, untracked files included |
   | `last` | `HEAD~1` | `HEAD` |
   | a branch | the default branch | the branch, checked out |
   | a sha or a range `a..b` | `a` | `b`, checked out when it is not `HEAD` |
   | a PR url or number | the PR base | `gh pr checkout <n>` |

   An empty diff stops here and is reported as empty, never as a green run.
2. **Run reviewrules** as `ref-reviewrules.md` § Run it says, with `<target>` the slug of the range.
3. **Report** `report.md`, the resolved range, and the exit code.
