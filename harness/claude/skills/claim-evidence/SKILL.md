---
name: claim-evidence
description: Use before asserting something as settled — "verified", "works", "fixed", "all tests pass", "it validates", "it does not exist", "already shared", "committed", "it emits/exports X", "the spec requires", "X because Y", "it renders". Checks that the evidence reaches as far as the claim, and names the one check that would settle it. Also use when offering the user design options, each of which asserts a mechanism exists.
---

# An assertion must not reach further than its evidence

Find the sentence in your draft that a reader would act on, then name what you actually
observed. When the two differ, either run the check or write the narrower sentence. A wrong
claim that *looks* evidence-backed is worse than an admitted unknown: it spends the reader's
trust and they build on it.

Each row below is a claim shape, the evidence that fails to support it, and the check that does.

| Claim | Fails when | Settle it with |
|---|---|---|
| **absence** — "not there", "zero hits", "unused" | output was truncated (`head`, `--limit`, one API page), stderr was suppressed (`2>/dev/null` hides command-not-found), or a 404 (which also means no access) | re-run unbounded and scoped to the thing itself; check the exit code (grep/rg: 1 = no match, 127 = binary missing); add a positive control on a term you know is present |
| **attribution** — "it's the cache", "goroutine leak", "that file is stale" | a measured magnitude is treated as proof of its causal label | name the confirming check and run it, or label the cause a hypothesis |
| **representative sample** — "healthy", "not the problem" | one point-in-time read, taken while idle | sample while the workload runs; corroborate with a second independent method |
| **quote strength** — "the spec requires", "as agreed" | your sentence is stronger than the source's words. The drift sites are `only`, `always`, `never`, `all`, `must`, and any count | paste the source sentence beside your draft; keep its axis — a bound on *kind* is not a bound on *count* |
| **source document** | the quote comes from an artifact you generated (`.notes/spec.md`, a plan, a summary) rather than the human-written source | read and cite the source; a disagreement with your derived file is a finding, not evidence |
| **verbatim record** | a table row, catalog entry, CSV line, or config key is paraphrased behind a `file:line` citation | paste the row verbatim under the claim; adjacent rows convict themselves |
| **existence** — "lives in a shared package", "already bundled" | prose says so and no code was searched | grep the source *and* the dependency manifests; a dependency inside one component's own package proves that component's private choice, not reusability |
| **production** — "it emits X", "the block exports this column", "the module publishes Y" | only the declaration was read — a spec constant, a builder, a schema, a type. A definition proves the shape exists, never that anything runs it | trace the declaration to a live caller, starting from the entry point the runtime invokes (the workflow/main body, the export site, the registration list). When the only callers are tests, write "declared, not wired" |
| **option feasibility** | an offered option names a relationship (import, share, extend) the platform may not support | quote the schema or config line that must accept it; a limit blamed on a dependency needs that dependency's signature, not one call site |
| **visual render** | data reached the file, it compiled, the fence was written | render it and look. A mermaid block that fails to parse shows the reader raw source with no error |
| **host environment** | it worked in your shell, but a hook, launchd, cron, or an editor agent will run it | run it the way the host will. PATH, `TMPDIR`, the sandbox, and process lifetime each differ silently |
| **stale artifacts** — calling someone else's code red | caches were not cleared and the module was not confirmed to resolve to the file you read | clear the toolchain's caches, re-run, quote the clean run. A false red accuses |
| **plugin availability** — "the `/command` is ready" | the source was written and the marketplace synced | install, enable, restart; `claude plugin details` reads the marketplace, so confirm the cache too |
| **validator PASS** — "the config is valid", "the schema accepts it", "it conforms" | the validator never inspects the dimension you are claiming. Schema checkers commonly ignore unknown/extra keys, so a PASS says every *present* key is legal — not that no key is stray, misplaced, or silently dropped downstream | run a negative control: break the exact thing you say was checked and confirm a FAIL. A PASS with no failing control proves the runner ran, not that the check exists. Then state the claim at the width the control established |
| **line number** — "line 71 is blank", "that field is not in the file", "you mean line 70" | you are resolving the reference against a Read from earlier in the session. Context holds a snapshot; the user, a linter, or a formatter may have edited the file since, and every line below an insertion has moved | re-read the exact range first, and cite the fresh read. When the user names a `file:line`, their number is current and yours is not — never correct their line number from a stale read |
| **commit contents** | the commit message names the file | read the VCS's own file list (`git show --stat`, `jj diff -r @- --stat`) |
| **subprocess output** | a nested `claude --print` exited 0 | assert a byte-count floor and a structural marker in the output |

## When a row fires, read its reference

Each row above is the check. The operational detail — the commands, the per-ecosystem tables, the
traps — lives in one file per row, read only when that row fires:

| Row | Reference |
|---|---|
| absence, attribution, representative sample | `references/measured-vs-inferred.md` — pprof under-counts cgo CPU (`-peek='cgocall'` un-buries it), read a cgroup limit instead of deriving it, the proxy-command table |
| quote strength | `references/quote-strength.md` |
| source document | `references/source-document.md` — plus what to do when your own derived artifact caused the user's false premise |
| verbatim record | `references/verbatim-records.md` |
| existence | `references/existence-claims.md` |
| option feasibility | `references/option-feasibility.md` — plus scoring each option at its strongest form |
| visual render | `references/visual-render.md` — the safe mermaid dialect, and screenshotting a spawned window |
| host environment | `references/host-environment.md` — the PATH / `TMPDIR` / sandbox / lifetime table |
| stale artifacts | `references/stale-artifacts.md` — stale carriers per ecosystem |
| plugin availability | `references/plugin-availability.md` — `update` vs `install`, and confirming the cache |
| subprocess output | `references/nested-claude-print.md` — the guard, and why a model call does not belong in a per-turn hook |

## Write the narrower sentence

When the check has not run, say so in the same sentence as the claim: "measured X; likely cause
Y (unverified — confirm with Z)". Quantify to what was observed — "no such line as of 15:57",
not "it never starts"; "not in the first 30 results", not "the repo has no such directory".

**When the user says a thing exists and your tooling says it does not, suspect the tooling
first.** They usually have grounds you cannot see. Re-run the search a different way before
contradicting them, and never ask them to prove their own claim on the strength of a search you
have not verified ran.

## What is automated

A Stop hook (`claim-check.mjs`) blocks an absence claim when the same turn ran a search with
`2>/dev/null` or piped output through `head`. It catches only those two mechanical cases — every
other row here is yours to check.
