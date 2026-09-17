---
name: doc-examples-must-lint
description: Use when writing code examples inside a rules or docs file that agents will copy verbatim — CLAUDE.md, .claude/rules/*.md, a SKILL.md, a style guide, a contributing doc. The linter never sees these snippets, so a good/bad example can teach a shape the repo's own lint job rejects. Check the enabled linter set before writing the snippet.
metadata:
  origin: self-improvement
---

# Doc examples must satisfy the repo's linters

A code example in a prose file is not compiled and not linted. Nothing catches it being wrong. But an agent copies it verbatim into real source, where the lint job does run — so a snippet that violates an enabled rule ships a lint failure to every future task that follows the doc.

Prose files carry authority without verification. Treat every example in one as unverified until you have checked it against the config that governs real code.

## Before writing the snippet, read the linter config

Find the config and read the *enabled* rule list — not the defaults you remember, and not the rules you happen to know.

| Ecosystem | Config to read |
|---|---|
| Go | `.golangci.yaml` / `.golangci.toml` — the `linters.enable` list |
| TS/JS | `eslint.config.*`, `.eslintrc*`, `biome.json` |
| Python | `pyproject.toml` `[tool.ruff]`, `setup.cfg`, `.flake8` |
| Rust | `clippy.toml`, `#![deny(...)]` in the crate root |
| Shell | `.shellcheckrc` |

A linter listed with **no settings block runs its defaults** — enabled, with every default rule on. Absence of a settings block is not absence of enforcement.

Then check the snippet against those rules specifically. The failure mode is a snippet that is idiomatic in general but violates a rule this repo turned on.

## Prefer examples that satisfy both the rule and the linter

When the point you are teaching seems to collide with a lint rule, that is usually a false conflict — find the form that does both, rather than teaching the violating form.

```
# teaching: "put the plain-words search phrase in the doc comment"
# godoclint start-with-name is enabled

bad:  // Checks whether the user session has expired.
      ^ carries the phrase, fails the linter

good: // SessionExpiryChecker reports whether the user session has expired.
      ^ carries the phrase AND starts with the declaration name
```

If the two genuinely cannot be reconciled, say so in the doc and name the linter — an agent hitting the failure then knows it was a deliberate call, not an oversight.

## Show the violating form only as an explicitly labeled `bad`

A `bad:` example is useful precisely because it is wrong. Keep it, and annotate *why* it is wrong, naming the rule:

```
bad: // Checks whether the session expired.   (fails godoclint start-with-name)
```

Never leave a violating snippet as the unlabeled or `good:` case.

## Sweep the whole file, not just the flagged line

These defects cluster: the same misunderstanding usually produced several examples. When a review flags one, grep the file for every other snippet of the same shape and fix them in the same change.

A comment rewritten to fix one of these snippets is still bound by the file's prose-style caps: see `wm:recheck-style-caps-after-any-comment-rewrite` for the rule that a rewrite must be self-checked against those caps before commit, since no gate currently checks it.
