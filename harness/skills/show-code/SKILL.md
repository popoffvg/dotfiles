---
name: show-code
description: Draw code that exists, or a rule before code exists, as pseudocode, a call tree, or a Codemap trace, each step with a clickable path:line. Loaded by the show-me router for a rule, a branch, an algorithm, a call order, or a code path across files.
user-invocable: false
---

# show-code — pseudocode, call tree, Codemap

## Pseudocode

One step per line, in Python syntax, fenced as ` ```python `: `def`, `if` / `elif` / `else`, `for`, `with`, `try` / `except`, `return`, `raise`. Use the code's own names, whatever the language of the source. No type hints, no `await`, no imports. A step with no call in the code is a call with a plain name, or a `#` comment.

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

A `flow-sketch` carries no references at all: nothing is written yet, so there is nothing to click.

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

## Code traces that survive the reply

Use a Codemap only for a code path across files that someone will revisit. `codelens` writes `docs/traces/<slug>.codemap.md`, walks its real code locations, and later re-anchors them with `codelens check`.

```markdown
# how a save reaches the cache or the disk
@ <short commit>
> src/session/save.ts:88 save

- the content is unchanged since the last write
  - src/session/save.ts:94 isUnchanged
    - src/session/cache.ts:31 cachedResult
      | the entry is read here and invalidated nowhere
- the content changed
  - src/session/save.ts:101 writeContent
```

Same flow as **Pseudocode** above, same locations as a **call tree** — the step names carry the rule, the nesting carries the calls, and the pin makes both re-checkable months later.

`#` is the question, `@` the commit pin, `>` an entry point, `-` a stage or `path:line:symbol` Node, and `|` a fact the code alone does not say. Indentation means part of the current step, not necessarily a direct call; expand a location once and repeat it bare thereafter.

