# show-code — flows, interleaving, pseudocode, call tree, component tree

Loaded by the `show-me` router for a running path, a race, a rule, a branch, an algorithm, a call order, or the components of a change.

## Flows

Show one running path per H3, in three parts:

1. **Heading:** the path in domain words, then its trigger: `### The session refresh, POST /auth/refresh`. When the path is a step of the main user flow of the project, add `— main flow step <n>`.
2. **Entry line:** the symbol that runs the path, in italic code: *`pkg/auth.Handler.Refresh`*.
3. **Block:** one `python` block from the entry point to its result, in the syntax of [Pseudocode](#pseudocode). Put one step on each line. Indent `if`, `for`, and `with` blocks to show branches, retries, and resource scopes.

Use the form without markers when no step changes.

```python
def Refresh(body):
    request = decode(body, RefreshRequest)
    if malformed(request):
        return 400
    token = store.lookup(request.refresh_token)
    if token is None or token.expired:
        return 401
    if token.used:                                  # +
        revoke(token.session)                       # +
        return 409                                  # +
    pair = TokenPair(                               # ~ was: one access token
        access=sign_access_token(token.user_id),
        refresh=sign_refresh_token(token.user_id),  # +
    )
    store.delete(token)                             # +
    emit(TokenRotated)                              # +
    return pair, 200
```

For a changed flow, mark each new step with `# +`. Mark changed behavior with `# ~ was: <before>`. Mark a moved step with `# moved, was: after <step>`. Show a removed step as `# - <step>` on its own line. Leave unchanged steps unmarked. Mark every line of a new path with `# +`. Put the markers in one column, so the reader scans the right edge for the change. If code exists, add its `path:line` after the marker. Give each unchanged step a trailing `# path:line`.

- Write a step in domain words. A step keeps its exact code name only in a trace of code that exists, or when the name is a public symbol or an error the caller matches on. No types, error plumbing, or imports.
- Every marked `if`, `elif`, `else`, or `raise` has a test case. A new path with no case is a path nobody tests.

Show the whole path through 20 lines. For a longer unchanged path, keep its entry, result, branches, and key steps. For a longer changed path, keep each changed line, its enclosing control lines, and one unchanged line on each side. Use `...` for omitted steps. Give each new loop, wait, retry, timer, or background task its own path when a call hides its steps.

## Interleaving

Use an interleaving timeline for a race: two or more actors run at the same time, and the order of their steps causes the result. Draw it in a `text` block.

- **Columns:** a `time` column, then one column per actor. The header names the actor and what it works on: `probe of V (event tx)`. A `─` rule sits under each header.
- **Rows:** one row per step, at time `t1`, `t2`, and on. A step goes in the column of the actor that runs it. The cells of the other actors stay blank, so the reader sees who moves at each tick.
- **Step text:** the action, then its effect after `→`. Write what the actor reads, decides, or writes, with the values: `snapshot: counter 0, forRetire clear`.
- **Reference:** a step that the code has carries a trailing `path:line`, aligned at the right edge of the block.
- **Commit rows:** a commit or a check that lets the bad state through says why in the same cell. Continue the text on the next line, indented under the step.
- **Last row:** the end state, after `→`. It is the state that breaks the rule.

```text
time   probe of V (event tx)                    hold of V (F2 = V)
────   ─────────────────────────────────────    ─────────────────────────────────────
t1     snapshot: counter 0, forRetire clear
t2     paused before commit                     snapshot: counter 0, forRetire clear
t3                                              counter +1 (untracked merge)       link_counters.go:181
t4                                              ClearForRetire() → already clear,  link_counters.go:187
                                                state unchanged → no state write   post_write_change_token.go:35
t5                                              COMMIT → counter 1, forRetire clear
t6     SetForRetire() (decided from t1 data)                                       refcount_probe.go:109
t7     COMMIT → no conflict: its only tracked
       read is V.state, and the hold did not
       write it
       → counter 1, forRetire set
```

Put one sentence under the block: the rule that the end state breaks. Show only the steps that change the result. A step that both orders give the same way is noise.

## Pseudocode

One step per line, in Python syntax, fenced as ` ```python `: `def`, `if` / `elif` / `else`, `for`, `with`, `try` / `except`, `return`, `raise`. In an existing-code trace, use the code's exact names, whatever the language of the source. For a change review, defer to `change-review`: use domain words and its rules for exact symbols and references. No type hints, no `await`, no imports. A step with no call in the code is a call with a plain name, or a `#` comment.

**A step the code already has carries a trailing reference; a step being proposed carries none.** The blank right column is what tells the reader which half of the rule is written. Write the reference as a repo-relative path plus line — `src/session/save.ts:94` — which is the form a Zed terminal turns into a click. A bare basename is not clickable; an absolute path is noise. Name the root once above the block when the paths are long.

```python
def save(content):                          # src/session/save.ts:88
    if is_unchanged(content):               # src/session/save.ts:94
        return cached_result()              # src/session/cache.ts:31
    write_content(content)                  # src/session/save.ts:101
    invalidate_cache_entry(content)
    return fresh_result()
```

Here the last two lines are the change: the cache is read today and never invalidated.

A proposed flow carries no references at all: nothing is written yet, so there is nothing to click.

## Call tree

Names are the tree. Location is metadata: a trailing `# path:line` aligned to the right, clickable and rooted as in **Pseudocode** above, shortened against a root named once under the block. A path on its own line is too loud — the reader came for the calls.

```
# under src/variants/
process_one                                            # build_variants.py:81
├── build_candidates_and_declines                      # variant_candidates.py:374
│   ├── admitted_targets                               # variant_candidates.py:201
│   └── _scored_dropping_blockers                      # variant_candidates.py:310
│       └── _cleared_candidate                         # variant_candidates.py:243
└── rank_variants                                      # variant_ranking.py:152
```

Two roots (a later pass, a second entry) are two trees, not one stretched trunk.

## Component tree

Use a component tree for the components that a change touches, or for which component owns which. Draw one tree per package, in a `text` block. The tree with the `main` component comes first.

- **Root:** the package path, then `# OWNS <one clause>`: what the package answers for once the change lands. A root line starts with two spaces.
- **Component:** a child of the root, named bare (`Handler`). Its line starts with a mark in the first column (`+` new, `~` changed, `-` gone) and ends with `# <brick> · <part> — <role>`.
- **Brick:** `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`. A component that fits no brick, or two, has two jobs: split it.
- **Part:** `main` or `supporting`. Exactly one component in all trees is `main`: the one that carries the outcome. Two candidates mean the change does two things.
- **Role:** one sentence, the slice of the component's job that this change touches.
- **Member:** a child of a component, one method, field, or case that the change decides. It has a mark and a comment with no `·` pair.
- **Every public member names its caller**: `called by <package.Symbol>`, or `implements <Interface>`. A member with no caller outside its package is private. A test is not a caller. A fixed sequence of calls that keeps one invariant is one public operation with private steps. A mechanism that keeps an invariant (a lease, a lock, a retry loop) is private.
- A component that the change only reads is not in the tree.

```text
  pkg/auth                            # OWNS the refresh exchange
~ ├── Handler                         #   server · main — exchanges a valid refresh token for a new pair
~ │   └── Refresh()                   #     returns a new pair and invalidates the old refresh token; called by cmd/api.Routes
~ └── TokenMinter                     #   command · supporting — mints an access/refresh pair for a user id
~     └── MintPair()                  #     returns a pair instead of one token string; called by pkg/auth.Handler.Refresh

  cmd/api                             # OWNS the HTTP routes
~ └── Routes                          #   wiring · supporting — maps POST /auth/refresh to the handler
```

With no change to show, drop the marks and the `<part>`: the tree then shows which package owns which component.
