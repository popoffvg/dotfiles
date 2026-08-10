An existence claim in prose is **unverified until you find the thing in code**. Specs describe the world their author wanted; the repo holds the world that shipped. Restating "already bundled" or "lives in one shared package" as fact makes a plan that assumes work is done when it is not — and the sentence reads equally confident either way, so nothing catches it downstream.

The claims that break most often:

- **"lives in one shared/versioned package"** — the package was proposed, never extracted. The thing is copy-pasted into N components already.
- **"already bundled / already cleared / reuses X"** — true of a sibling component's *private* dependency, not of anything you can call. Vendored ≠ shared.
- **"the V1 backend is <tool>"** — named as settled, packaged nowhere. Zero references in the tree.
- **"we consume it from the X component"** — the platform may not permit that call at all; only the declared data contract crosses the boundary.

## Procedure

1. **Grep for the thing itself**, across the whole relevant tree — not just the component you are working on. Search the dependency manifests (`pyproject.toml`, `package.json`, `go.mod`, lockfiles) *and* the source. Zero hits is a finding, not a search failure.
2. **When you do find it, read how it is wired.** A dependency inside one component's own package is that component's private choice — it proves the license and the packaging recipe, nothing about reusability.
3. **If the claim is a shared module, open it.** No file, no module. Two copies of the same content in different components means the shared module does not exist, however the spec phrases it.
4. **Report the gap as a decision, not a typo.** "The package does not exist" changes the plan: either extracting it becomes a prerequisite, or the spec should say the content is copied and a parity check is owed. Both are the author's call — surface it, don't silently pick one.
5. **If you cannot verify**, write the claim as unverified in the deliverable rather than passing it through. `[unverified: spec says X is shared — not found in <tree>]` costs one line and keeps the plan honest.

## Why it matters more in a plan than in prose

A wrong existence claim in a spec is one sentence. The same claim inside an estimate, a build plan, or a slide of "what each step runs" silently removes work from scope — someone budgets zero days for packaging a tool that has never been packaged.
