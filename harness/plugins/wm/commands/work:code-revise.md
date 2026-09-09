---
name: work:code-revise
description: Reconcile a TODO's review correction or shipped drift through the arch revision procedure.
argument-hint: <TODO-N> [<sha-or-range>]
---

Run `arch:sub-revise.md` for `$ARGUMENTS`. It owns the delta manifest, commit discovery, and
notes-only reconciliation.

If `$ARGUMENTS` lacks a TODO id, ask which TODO to revise.
