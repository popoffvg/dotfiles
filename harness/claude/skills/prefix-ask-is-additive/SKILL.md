---
name: prefix-ask-is-additive
description: >-
  Use when the user asks to add or apply a prefix, namespace, or naming
  convention to a family of externally-consumed identifiers — metric names,
  env vars, API/JSON fields, DB columns, CSS classes, feature flags, log keys —
  and some existing names already carry it. Decides whether the ask means
  "rename the established ones" or "name the new ones this way". Triggers on
  "add prefix X to every Y", "namespace these under X", "prefix all the Z".
metadata:
  origin: self-improvement
---

# A prefix ask is additive until the user says "rename"

When asked to apply a prefix/namespace to a family of names, first check whether
the existing names **already carry it** — including as a structured component
that renders into the final string (a Prometheus `Subsystem`, a package path, a
table prefix, a BEM block).

- **Already present → the ask covers the NEW names you're adding.** Apply the
  convention to those; leave the established names alone. Say in one line that
  the existing ones already satisfy it.
- **Genuinely absent → renaming is on the table**, but see below.

## Don't offer a rename as an option

Do not surface "rename the existing ones" as a choice (an `AskUserQuestion`
option, a recommended variant, a "while we're here"). Renaming an
externally-consumed identifier is a separate, breaking decision the user makes
deliberately — not a side effect of an additive request.

Offering it as a plausible-looking option invites a yes that gets reversed once
the diff is real, and the churn costs a full revert across code, tests, docs,
and changelog.

Proceed with a rename only when the user says *rename* (or names the old and new
form explicitly).

## Why these identifiers are different

They have consumers outside the repo that your diff cannot update:

| identifier | breaks |
|---|---|
| metric name | Grafana dashboards, alert rules, recording rules |
| env var | deployment manifests, CI secrets, local `.env` files |
| API/JSON field | every client, including released ones |
| DB column | migrations, downstream ETL, analytics queries |
| log key | saved log queries, parsing pipelines |

A rename is a coordinated change plus a deprecation window, not an edit. If you
believe one is genuinely warranted, state the case in a sentence and let the
user decide — after delivering the additive work they asked for.

## Check before deciding

Reconstruct the **rendered** name, not the source literal. A metric declared as
`Namespace: "core", Subsystem: "rocksdb"` renders `core_rocksdb_*` — the
"rocksdb" prefix is already there even though no string in the source reads
`"rocksdb_"`. Grep the emitted form (or gather the registry / dump the output)
before concluding a prefix is missing.
