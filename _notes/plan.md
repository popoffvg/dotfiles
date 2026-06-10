# Plan

## Description
Rewrite memory-keeper so knowledge capture is driven by **git events** instead of conversation slices. The `~/ctx/insights/<project>/` tree becomes the primary store with **one file per topic**; the per-repo `_notes/` directory keeps only **pointers** (path + title) into that tree. On commit and on pull, git hooks invoke a headless `claude -p` running a purpose-built **CaptureAgent**, which analyzes git history and either creates a new topic file or verifies-and-updates an existing one. The old conversation-capture daemon, maildir queue, SQLite drain daemon, and Pi cron capture are removed. Semantic search over the knowledge base moves entirely from **QMD to cocoindex** (`mcp__cocoindex-mil__search` over a `~/ctx/insights` workspace); QMD and the `z-core` Obsidian fallback are retired. The read experience (`context-find` + deterministic `INDEX.md` fallback) is preserved, just backed by cocoindex.

## Terms

| Term | Kind | Notes |
|------|------|-------|
| TopicFile | entity | One Markdown file per topic at `~/ctx/insights/<project>/<topic>.md`; the canonical store |
| ResearchPointer | value-object | A `_notes/research/*` stub holding only a title + path link to a TopicFile — never full content |
| CaptureAgent | component | A **new**, purpose-built agent definition (in the plugin's `agents/`) that `claude -p` runs headlessly to analyze one ChangeBucket and write TopicFiles. Tool-constrained, non-interactive, deterministic output contract. Distinct from the interactive `context-keeper` (which stays for find/read) but may share the `context-save` skill |
| CaptureOrchestrator | component | Script that extracts git context, applies the pre-gate, and spawns the detached `claude -p` CaptureAgent run |
| GitCaptureHook | component | `post-commit` / `post-merge` / `post-rewrite` hooks in the global `core.hooksPath` dir that delegate to the CaptureOrchestrator |
| PreGate | policy | Cheap, no-LLM filter that skips empty / merge-only / trivial diffs before spawning `claude -p` |
| LastProcessedCommit | state | Per-repo marker of the last commit analyzed, so a range can be derived for `post-merge`/`post-rewrite` |
| ChangeBucket | value-object | A deterministic, no-LLM pre-grouping of changed paths from a commit range (by path prefix / co-change); the unit of one `claude -p` run and the unit the top-K cap applies to |
| Topic | value-object | The LLM-resolved semantic subject of a change (a 3–7 word slug); the unit of storage. One ChangeBucket run resolves to one or more Topics by matching against existing TopicFiles via CtxIndex search |
| CtxIndex | service | cocoindex workspace over `~/ctx/insights`, queried via `mcp__cocoindex-mil__search`; the sole semantic-search backend, replacing the QMD `ctx` collection and `z-core` fallback. Read-only — has no save API; new TopicFiles are picked up by `refresh_index` |
| CaptureRequested | command | A GitCaptureHook asks the CaptureOrchestrator to analyze a commit range; issued in the background, non-blocking |
| TopicCaptured | event | CaptureAgent wrote a new TopicFile and its ResearchPointer |
| TopicUpdated | event | CaptureAgent verified an existing TopicFile against git history and edited it in place |

## Implementation Guidelines

### Skills
- `shell-modify` — for the thin bash git-hook scripts (and the `claude`-resolution guard).
- `laptop-setup` — add Bun to the ansible playbook (build-time dependency) and wire the binary build-on-install step.
- `agent-development` / `agent-creator` — for creating the headless CaptureAgent definition.
- `skill-development` — for reworking the `context-save`/`context-find` SKILL.md prose.
- `ccc` — cocoindex workspace setup, indexing, and `ccc doctor` verification for the `~/ctx/insights` index.
- `impl-commit` — commit conventions; one TODO = one commit.

### TODO authoring (plan-todo-prepare)
- **Memory-keeper reminder — every TODO body starts with it:** before implementing, (1) **launch memory-keeper** (`context-keeper` agent) to pull persistent context for the touched project/topic, and (2) **grab the plan** — read `_notes/plan.md` so the outcome and decisions are in context. TODO files are written for a dummy implementer; this reminder is part of the template, not optional prose.

### Coding Patterns
- **Global hook = global concern + delegate.** Follow the existing `pre-commit` shape (`git/dot-config/git/hooks/pre-commit:1-19`): the global hook runs its own concern, then delegates to a repo-local tool. New hooks delegate to the CaptureOrchestrator and return immediately.
- **Hook = thin bash; orchestrator = compiled binary (D11).** Author in TS, ship via `bun build --compile`; the bash hook execs the binary directly — no interpreter, no per-commit transpile.
- **Self-contained = no runtime-version problem (D12).** The binary has no ambient node/bun dependency at commit time; only `claude` is resolved at run time, with a visible-fail guard (log + exit 0) so capture never blocks or silently disappears.
- **Stow source of truth.** Hooks live in `harness`/dotfiles source `git/dot-config/git/hooks/`, symlinked to `~/.config/git/hooks` by stow — never edit `~/.config/...` directly.
- **Reuse `common/memory.ts` primitives** — project detection (`:120-124`), dedup (`:371-378`), `extractHeadings` (`:312-322`), and `saveInsight` routing (`:402-444`) survive and are refactored toward topic-per-file; do not rebuild them.
- **Best-effort, never block git.** Capture is detached background work; a failure in capture must never fail a commit, merge, or rebase.

### References
- `harness/plugins/memory-keeper/common/memory.ts` — `saveInsight` routing, dedup, `extractHeadings`, project detection (the store leaf to refactor).
- `harness/plugins/memory-keeper/claude/agents/context-keeper.md` — existing interactive router; the new CaptureAgent definition lives alongside it in `agents/`.
- `~/.config/worktrunk/config.toml` (`[commit.generation]`) — the environment's existing headless `claude -p` invocation pattern (`--tools='' --disable-slash-commands --setting-sources='' --system-prompt=''`) to mirror when invoking the CaptureAgent.
- `harness/plugins/memory-keeper/skills/context-save/SKILL.md`, `context-find/SKILL.md` — storage-path prose to rework (source of truth; mirrored in `claude/skills/`).
- `git/dot-config/git/hooks/pre-commit` — existing global-hook delegate convention to mirror.
- `mcp__cocoindex-mil__search` — the new search backend (semantic search over a directory; `paths`/`languages` filters; `refresh_index` at query time; no save API).
- `~/.cocoindex_code/global_settings.yml` — cocoindex daemon config (sentence-transformers embeddings); the `ccc` skill drives workspace setup/`ccc doctor`.
- `harness/plugins/memory-keeper/claude/hooks/hooks.json`, `claude/worker/`, `claude/lib/queue.mjs`, `common/server/daemon.ts`, `common/server/drain-worker.ts`, `pi/index.ts` cron — the capture machinery to remove.
- `_notes/analysis-memory-keeper.md` — full current-state architecture analysis.
- `_notes/spikes/capture-orchestrator.mjs` — annotated planning skeleton of the CaptureOrchestrator (the key component): language, persistence paths, concurrency, runtime resolution, and `claude -p` invocation made concrete. Includes the thin bash hook sketch. Proposes `.git/memory-keeper/cursor` for LastProcessedCommit.

## Goal
When this work is done, the user's knowledge base is maintained automatically by their git activity, not by their chat. Every commit and every pull triggers a background analysis that records what changed into a per-topic Markdown file under `~/ctx/insights/<project>/`, updating an existing topic in place (informed by git history) rather than duplicating it. Each repo's `_notes/research/` contains only lightweight links back to those topic files, so research notes stay small and point at the canonical store. Commits and merges are never slowed or blocked by capture. The old conversation-capture daemon and queues are gone, while searching memory (context-find / QMD `ctx` / `INDEX.md`) works exactly as before.

## Design Decisions

### D1 — Git-event capture only; remove conversation capture
**Decision:** Capture is triggered solely by git hooks. The `UserPromptSubmit`/`Stop` hooks, maildir queue, `.mjs` daemon, SQLite drain daemon, and Pi cron capture are deleted.
**Rationale:** Commits/pulls are concrete, reviewable units of change; conversation-slice capture was noisy and ran two parallel stacks for one store (user decision).
**Trade-offs:** Knowledge created purely in conversation (never committed) is no longer auto-captured; the user can still invoke `context-save` manually.

### D2 — One TopicFile per topic; `_notes/` holds only pointers
**Decision:** `~/ctx/insights/<project>/<topic>.md` holds the full content; `_notes/research/*` holds only a ResearchPointer (title + path link).
**Rationale:** Keeps the canonical store de-duplicated and per-topic addressable; keeps repo notes small and authoritative-by-reference (user decision).
**Trade-offs:** More files in the ctx tree; `INDEX.md` and dedup logic must move from per-category to per-topic granularity.

### D3 — `claude -p` does the analysis; no Haiku triage, but a non-LLM PreGate stays
**Decision:** The hook spawns a headless `claude -p` CaptureAgent that analyzes git history and writes/updates the TopicFile. No Haiku classification stage.
**Rationale:** Single agent path is simpler and the user chose it.
**Trade-offs:** `claude -p` startup is seconds and the run is comparatively expensive — so a cheap non-LLM **PreGate** (skip empty/merge-only/trivial diffs) is required to avoid firing on every trivial commit. **Note: the originally-mentioned Haiku triage is dropped per the user's selection — flag if noise/cost proves this wrong.**

### D4 — Install via the existing global `core.hooksPath`, no override change
**Decision:** Add `post-commit`, `post-merge`, and `post-rewrite` files to `git/dot-config/git/hooks/` (stow → `~/.config/git/hooks`). `core.hooksPath` already points there; the three hooks are currently **absent**, so nothing is clobbered.
**Rationale:** Verified: `git config --global core.hooksPath` = `~/.config/git/hooks`; existing `pre-commit` already delegates to repo-local `lefthook`. Reusing this dir means capture fires across all repos with no per-repo install.
**Trade-offs:** All repos get capture by default; an opt-out mechanism (env var / per-repo marker) may be wanted later.

### D5 — Detached, non-blocking, per-topic-serialized capture
**Decision:** Hooks fire the CaptureOrchestrator in the background; the orchestrator serializes concurrent writes to one TopicFile with a per-topic lockfile and debounces a multi-commit pull into a single ranged analysis.
**Rationale:** Replaces the removed queue's async + serialization guarantees without re-introducing a daemon; prevents two `claude -p` runs racing on the same file and prevents a 20-commit pull spawning 20 agents.
**Trade-offs:** A lockfile-based approach is simpler but coarser than a real queue; long analyses can serialize behind each other.

### D6 — Two-stage topic extraction: deterministic pre-group, then LLM resolution
**Decision:** Topic extraction is split.
- **Stage 1 (no LLM):** For the whole `LastProcessedCommit..HEAD` range, a cheap pass (`git log --name-only` / `git diff --stat`) pre-groups changed paths into **ChangeBuckets** by a mechanical key (path prefix / co-change). This bounds the number of agent runs and is the unit the top-K cap (D7) applies to. It does **not** name topics.
- **Stage 2 (the one `claude -p` per ChangeBucket):** The run receives the bucket's commit subjects + scoped diff **plus the list of existing topic slugs** for the project (`ls ~/ctx/insights/<project>/`). It queries CtxIndex (cocoindex) to find the nearest existing Topic, then decides **update** (verify that TopicFile against git history, edit in place) vs **create** (mint a new semantic slug), and emits one or more TopicFile writes + ResearchPointers.
**Rationale:** The cheap pre-group makes cost scale with *areas changed* (~8 runs), not commits (150), and keeps each agent's context bounded. Topic *identity* stays semantic and LLM-resolved — matching the existing slug style (`architecture`, `obsidian-sync`) — because directory names are the wrong granularity. Existing-vs-new matching reuses the preserved read path (D8), not a new mechanism.
**Trade-offs:** Stage 1 clustering is a heuristic and can mis-group, but the storage unit is the LLM-resolved Topic, so mis-grouping only costs redundancy, never corruption: two buckets resolving to one Topic are serialized by the per-topic lockfile (D5); one bucket spanning two Topics emits two writes. A cross-cutting refactor touching many areas still fans out to many buckets (bounded by the cap, D7).

### D7 — Per-event topic cap + bootstrap cap, with explicit logging (no silent truncation)
**Decision:** Cap ChangeBuckets processed per capture event to top-K by change volume; **log** any deferred remainder and advance LastProcessedCommit only over what was actually processed, so the rest is picked up on the next event or a manual sweep. On first install / missing cursor (an effectively unbounded range), cap to the last N commits and log that history before that point was not analyzed — never replay full history.
**Rationale:** Bounds worst-case cost per pull and avoids a fresh clone trying to analyze the entire repo history; logging keeps "bounded coverage" honest rather than pretending everything was captured.
**Trade-offs:** Deferred topics lag until a later event; K and N are tunable knobs that need sensible defaults (see Open Questions).

### D8 — Read experience preserved, backend swapped to cocoindex
**Decision:** `context-find` and the deterministic `INDEX.md` fallback stay as the read interface, but the semantic backend changes from QMD `ctx` (+ `z-core`) to CtxIndex (cocoindex). The intent ("search my knowledge base") is unchanged for the user.
**Rationale:** The read experience is good; this rewrite changes how knowledge gets in *and* which engine indexes it, not the user-facing find flow.
**Trade-offs:** `INDEX.md` generation must be updated to reflect topic-per-file, or it drifts; and the find flow now inherits cocoindex's indexability/freshness characteristics (see D9).

### D9 — Move the entire context base from QMD to cocoindex
**Decision:** cocoindex (`mcp__cocoindex-mil__search`) is the sole semantic-search backend for the knowledge base, over a `~/ctx/insights` workspace. QMD (`ctx` collection, `qmd_search/query/get` tools, `qmd-stats` hook, `track-qmd` endpoint) and the `z-core` Obsidian fallback are removed. There is **no separate "save" step** — TopicFiles written to disk are indexed by cocoindex's `refresh_index`.
**Rationale:** The rewrite already makes TopicFiles plain on-disk markdown, so a write-capable document store (QMD) is no longer needed — a read-only directory index fits. Consolidating on one engine (cocoindex) removes the dual QMD/z-core surface and the stats/tracking plumbing.
**Trade-offs / risks:** cocoindex-code is built for *code* workspaces (local sentence-transformers embeddings); indexing a pure-markdown KB outside any repo is **unverified** and is the load-bearing risk (see Open Questions — prototype before committing). Embedding-based dedup that QMD provided must be re-sourced from cocoindex search results or kept as the local heuristic in `common/memory.ts`.

### D10 — Dedicated headless CaptureAgent, not the interactive context-keeper
**Decision:** Create a new agent definition (e.g. `agents/capture-agent.md`) purpose-built for the headless capture run, separate from the interactive `context-keeper`. The CaptureOrchestrator invokes it via `claude -p` with a constrained surface — system-prompt/agent file + restricted `--allowedTools` (read git, query cocoindex, write under `~/ctx/insights` and `_notes/research/`), `--disable-slash-commands`, no session — mirroring the worktrunk headless pattern. Its output is a deterministic contract (which TopicFiles were created/updated) so the orchestrator can log TopicCaptured/TopicUpdated.
**Rationale:** A headless, automated run needs tight tool scope, no interactive routing, and a predictable result; overloading the interactive router (built for human-driven find/save) would make the capture path fragile and hard to constrain. Authored with the `agent-development` / `agent-creator` skills.
**Trade-offs:** A second agent to maintain, with some skill overlap (both may use `context-save`); mitigated by keeping shared behavior in the `context-save` skill rather than duplicating prose across agents.

### D11 — Capture pipeline: thin bash hook + a compiled CaptureOrchestrator binary (Bun)
**Decision:** The synchronous git hook is bash (matches the existing global `pre-commit`); it pre-gates cheaply and execs a **self-contained CaptureOrchestrator binary** built from TypeScript/JS via `bun build --compile`. No `tsx`, no per-commit interpreter startup.
**Rationale:** The hook fires on every commit in every repo, so its synchronous part must be near-zero startup; a compiled binary starts in ~1ms and lets us author in typed TS while paying zero transpile/runtime-resolution cost at commit time. Bun (over Deno) is chosen for lower-ceremony `--compile` — Deno bakes `--allow-*` permission flags into the binary.
**Trade-offs:** Adds Bun as a **build-time** dependency (neither bun nor deno is currently installed — must be added to the ansible playbook via `laptop-setup`); the binary is per-platform (darwin/arm64) and is **built on install**, not committed to git; breaks the repo's usual "no build step" norm — justified here because it removes a runtime-fragility class.

### D12 — Eliminate the runtime-version problem via the self-contained binary; only `claude` resolution remains
**Decision:** Git hooks run in a stripped environment where `mise` activation is absent, so "which node" is unpredictable (interactive `node` is homebrew `/opt/homebrew/bin/node`; mise holds 20.19.3 + 22.22.2; a repo `.mise.toml` may pin another). The compiled orchestrator binary (D11) **removes the orchestrator's ambient-runtime dependency entirely** — there is no node to resolve. The remaining runtime dependency is `claude` itself (spawned for the agent run): the orchestrator resolves it (`command -v claude` → pinned path) and, if absent, appends `{"kind":"no_claude"}` to the capture log and exits 0. Never block the commit, never fail silently.
**Rationale:** The user's directive — "always face it." A self-contained binary is the head-on fix: nothing about the laptop's node/bun/mise state at commit time can break or silently drop capture. Bun is needed only to *build* the binary, never to run it.
**Trade-offs:** Build-time toolchain + per-platform binary (see D11); `claude` resolution still needs the visible-fail guard; the install step must rebuild the binary when the orchestrator source changes (a `mise` task / ansible hook).

## TODO List

> Index only — outcomes, not bodies. Order = execution order, deepest call-layer first.
> Bodies are authored separately (via `plan-todo-prepare`) once these outcomes are signed off.

| # | Layer | Outcome |
|---|-------|---------|
| TODO-1 | L0 — store leaf | Saving a topic writes one TopicFile per topic, and re-saving an existing topic updates that same file in place instead of duplicating. |
| TODO-2 | L0 — git input leaf | A capture call can derive the exact commit range to analyze from any git event, recording a LastProcessedCommit per repo. |
| TODO-3 | L0 — search backend | Searching the knowledge base returns relevant TopicFiles via cocoindex over `~/ctx/insights`, with no dependence on QMD. |
| TODO-4 | L1 — pointers | Each captured topic leaves only a ResearchPointer (title + link) in `_notes/research/`, never full content. |
| TODO-5 | L2 — capture agent | A dedicated headless capture agent exists that, given a ChangeBucket, matches existing topics via cocoindex, verifies against git history, and emits a TopicCaptured or TopicUpdated result over a deterministic output contract. |
| TODO-6 | L3 — orchestrator | A commit or large pull triggers at most one bounded background analysis per changed topic, serialized so runs never corrupt a TopicFile, with deferred topics logged rather than dropped. |
| TODO-7 | L4 — wiring | Committing, merging, and rebase-pulling automatically request capture without blocking or failing the git operation. |
| TODO-8 | L5 — cleanup | Conversation-capture hooks, the maildir queue, the SQLite drain daemon, the Pi cron capture, and all QMD/`z-core` tooling no longer exist, while memory search still works via cocoindex. |

## Open Questions
- [ ] **cocoindex indexability (load-bearing risk):** can `~/ctx/insights` be registered as a cocoindex workspace and does markdown embed/retrieve usefully with `snowflake-arctic-embed-xs`? Prototype with `ccc` + `mcp__cocoindex-mil__search` before committing — if not, the read path needs a different backend. Affects D9/TODO-3.
- [ ] **Index freshness:** is `refresh_index` at query time fast enough that a TopicFile written by one capture is matchable by the next capture moments later, on a large KB? Affects D6/D9/TODO-5.
- [ ] **Dedup source:** with QMD gone, does dedup rely on cocoindex search hits, on the local heuristic in `common/memory.ts:371-378`, or both? Affects D9/TODO-1.
- [ ] **Rebase-pulls:** `git pull --rebase` fires `post-rewrite`, not `post-merge`. Confirm we add `post-rewrite` so rebase-pulls are captured (assumed yes in TODO-6).
- [ ] **LastProcessedCommit location:** per-repo file (e.g. `.git/memory-keeper-cursor`), a note in `~/ctx`, or git ref? Affects TODO-2.
- [ ] **Debounce window:** collapse a multi-commit pull into one ranged analysis, or one run per commit with a short debounce? Affects TODO-5.
- [ ] **INDEX.md:** does topic-per-file require regenerating per-project `INDEX.md`, and who owns that — the CaptureAgent on each write, or a separate pass? Affects D6/TODO-5.
- [ ] **CaptureAgent model:** which model does the headless run use — `sonnet` (quality) or `haiku` (cheap/fast, matching worktrunk's commit-gen)? The user chose "no Haiku triage", but the agent's own model is a separate call. Affects D10/TODO-5.
- [ ] **Binary build-on-install (D11):** where does `bun build --compile` run — an ansible task, a `mise` task, or a stow post-hook — and how is the per-platform binary kept in sync when the orchestrator source changes? Affects D11/TODO-7.
- [ ] **Agent invocation mechanism:** point `claude -p` at the agent via `--append-system-prompt`/system-prompt file, or rely on the plugin `agents/` discovery + an agent-selecting prompt? Affects D10/TODO-5/TODO-6.
- [ ] **PreGate heuristic & dropped Haiku:** is a diff-size/path-based PreGate enough to keep noise/cost down without the Haiku triage stage? Affects D3/TODO-5.
- [ ] **Opt-out:** since hooks fire in every repo, do we need a per-repo or env opt-out before rollout? Affects D4/TODO-6.
- [ ] **Stage-1 bucket key:** group changed paths into ChangeBuckets by path prefix (how many segments?), by co-change, or both? Affects D6/TODO-5.
- [ ] **Stage-2 match threshold:** what QMD `ctx` similarity score counts as "same existing Topic" (update) vs "new Topic" (create)? Reuse the existing dedup thresholds (same-project ≥0.7) or tune? Affects D6/TODO-4.
- [ ] **Cap defaults K and N:** sane top-K buckets-per-event and bootstrap last-N-commits? (starting guess: K≈8, N≈30.) Affects D7/TODO-5.
