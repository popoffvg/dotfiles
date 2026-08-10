# An option with no mechanism is not an option

Before offering the user a choice between designs, prove each branch is buildable **here**. An option
that cannot be built wastes the user's decision: they pick it, you discover the wall, and they have to
decide again with different information. The second ask is the cost — and it lands after they already
believed the question was settled.

Knowing the target does not exist is not the same as knowing it can be created. "The shared package
does not exist yet" is an existence fact (that is
[[verify-claimed-dependency-exists]]); "the platform can host a shared package" is a
*capability* fact, and only the second one makes "extract it" an option.

## Procedure

Run both steps before writing the option text.

1. **Search for a precedent.** Find something in the org, monorepo, or platform that already does the
   thing. A precedent settles feasibility and supplies the shape at once — and if the user knows it
   exists, an option list authored without it reads as not having looked. Search repo/package names,
   not only code: the answer is often a whole package or repo whose name states its job
   (`software-*`, `assets-*`, `*-common`, `*-shared`).
2. **Read the schema or config that would have to accept it.** For each option, name the specific
   declaration it needs and confirm the format permits it — the package manifest, the artifact schema,
   the plugin descriptor, the build config. Quote the line in the option's description.

Then write the options, and state each one's mechanism inside it. If a branch has none, either drop it
or label it plainly as requiring new infrastructure, with what that infrastructure is.

## What the check catches

| Assumption in an option | The wall |
|---|---|
| "extract the shared code into a package both consumers import" | The artifact schema allows exactly **one** source root, and the consumers are separate repos with no shared tree — so there is nowhere for shared source to live |
| "add it as a dependency" | The dependency mechanism resolves from a registry nothing here publishes to |
| "reference the other component's module" | The reference imports a built artifact, not source to merge |
| "put it behind the existing flag" | The flag is read at build time, not run time |

The pattern: the option names a *relationship* between components (import, share, reference, extend,
inherit) and the platform only supports a narrower one.

## The inverse: a limit you attribute to a dependency

The same check runs on constraints, not only on possibilities. A rationale that says "we process one
item per invocation **because** the library takes one" asserts a capability limit — and that claim
needs the library's signature, not its usage at one call site.

1. **Read the entry point's parameters.** A plural parameter name or a `batch_size` /
   `max_items` / `concurrency` argument is the whole answer, and it is one grep away when the
   dependency is vendored in-repo.
2. **Check the CLI or config surface too.** A flag exposing the parameter proves the capability is
   supported, not incidental.
3. **Restate the constraint as your own choice.** If the library does support the broader mode,
   the design may still decline it — but then the reason is yours (failure isolation, reporting
   granularity, resource shape), and the write-up must say so. Attributing your choice to the
   dependency's limit is a false constraint: it survives review unchallenged and blocks a future
   optimization nobody re-examines.
4. **Name what the choice gives up**, once you know the broader mode exists — repeated model or
   checkpoint loads, no GPU batching, per-item container startup. Those costs are invisible while
   the limit is believed to be external.

## Score the strongest form of each option

Compare each alternative at its best, not at the version that falls out of the current design. An
option carried over with today's constraints still attached is a straw man: it loses on costs its
strong form would not pay, and the comparison reads as settled when the real alternative was never
scored.

- **Vary the dimension the option is about, and only that one.** If the option moves *where* steps
  are declared, do not silently keep today's *granularity* — that granularity may be the thing the
  option would change.
- **A false limit you believed earlier is what usually produces the straw man.** The strong form
  was unthinkable while the constraint looked external, so it never entered the table. After
  correcting such a limit, re-open the comparison that was written under it.
- **When the user re-specifies an option in a stronger shape, say plainly that it differs from
  what you scored** and re-cost it on its own terms, instead of reusing the old verdict.

## Why this fails silently

Option text is authored in the voice of a decision already scoped, so nothing in it signals an
unverified assumption — "create the shared package and migrate both consumers" reads exactly as
confident as an option that was checked. The user has no way to spot the gap; they are choosing
between outcomes, not auditing mechanisms. You are the only one positioned to catch it, and only
before the question is sent.

## When re-asking is unavoidable

If a chosen option turns out to have no mechanism, re-ask immediately and lead with the constraint and
its evidence — the schema line, the missing registry, the repo layout. Do not silently substitute a
different option: the user decided, and switching their decision without saying so is worse than the
extra question. Carry their original intent into the new options so the second ask is narrower than the
first, not a restart.
