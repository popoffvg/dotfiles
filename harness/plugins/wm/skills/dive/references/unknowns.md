# dive · unknowns route

Guided conversation — the **quadrant walk**. Map the unknowns of a task with the user *before* code is written, one quadrant per stage, ending with a completed four-quadrant map in the user's hands.

The map is not the territory. The prompt, the plan, the context window are the map; the codebase, the domain, the user's actual intent are the territory. The gap between them is the unknowns — one found before code costs minutes; the same one found three PRs later costs the three PRs.

The map is the deliverable. Implementation is a separate task that starts only after the map is handed over. Write the finished map to `$RESEARCH_DIR/<slug>.unknowns.md` (resolve `$RESEARCH_DIR` per the SKILL's "Output location").

## Two moves at every stage

- **Reacting beats imagining.** Never ask the user to describe what they want when you can hand them something concrete to react to — a rendered option, a clickable mock, a decisions table. Reaction extracts knowledge the user has but cannot articulate unprompted.
- **Every artifact assembles the reply.** End each artifact with the user's next message pre-drafted: steal/skip chips, resonate checkboxes, a decisions table, a copyable sharpened prompt — so their reaction becomes their next message with near-zero typing.

## The walk — five stages, in order, one at a time

Name the current quadrant as you go. Finish the stage in front of you before opening the next. Stop at every boundary that needs the user's reaction.

### 1. Known knowns — open with the settled ground

Scan the territory first (silent). Use parallel subagents — split the code the task touches among them — so the opening lands fast, not after a long serial read. Gather: what already exists (including half-built or reverted prior attempts), the data shapes and conventions the code enforces, anything load-bearing.

Opening reply: list the settled ground — the request as understood, facts the territory pins down (cite files), constraints and decisions already made. Distinguish locked from assumed; flag assumptions as "settled unless you say otherwise". Name the three quadrants ahead, one line each. Disclose any load-bearing finding now (don't save it for its stage). The first stage-2 question may ride along.

**Done when** the user has the settled ground with citations, knows which assumptions are treated as settled, and sees the three stages ahead.

### 2. Known unknowns — the questions you can name

Inventory the questions the task can't proceed without; disclose the queue ("still queued after this: …"). Resolve **one at a time, highest architectural blast radius first** — never a wall of questions. Give a recommended answer with each, as lettered options answerable in a few characters.

Close every question one of three ways: **answered by the user**; **answered by the territory** (go read it, then show the user the question and found answer — off-screen isn't closed); **recorded OPEN** on the map with what unblocks it.

Techniques: **interview** (one question/turn by blast radius, each with a recommendation, end with a decisions table); **brainstorm the intervention** (when "which solution?" — search the code, plot ~10 interventions from ship-this-afternoon to quarter-long bet, grounded in what exists); **point at a reference** (when an existing impl encodes the wanted behavior — produce a semantics map: what it does with excerpts, how each behavior maps to the target stack, every place the port can't be literal; nothing ported until sign-off).

**Done when** every named question is closed one of those ways, in front of the user. Announce closed (a decisions table recaps well) before stage 3.

### 3. Unknown knowns — extract what was never articulated

Taste, vocabulary, tacit conventions the user or codebase holds but nobody put into words — otherwise surfacing as "oh, one thing I forgot" too late. Asking "what do you want?" gets a shrug; hand over something concrete instead, grounded in the user's real data so the thing judged is the only variable.

Probe for unstated context deliberately: **who consumes this, where it runs, what done looks like to whoever inherits it** — the decisive constraint usually arrives as a throwaway remark. When an extracted fact reshapes earlier decisions, say so and update the map.

Techniques: **design directions** (same real data four incompatible ways, steal/skip chips); **mock before you wire** (throwaway clickable mock, fake data, toggleable placements/A-B, before touching the real app); **teach the vocabulary** (ladder from the user's words to domain terms, each rung paired with the prompt it unlocks); **the concrete sample** (for non-visual output — file format, API response, report — show the actual artifact with labeled fake data and per-line steal/skip).

**Done when** the user has reacted to something concrete, context probes are answered (or explicitly shrugged off), and extracted answers are on the map.

### 4. Unknown unknowns — hunt the landmines

What neither of you knows to ask, the territory often does. Sweep every file the task touches (state coverage: "the sweep covered the N files this task touches"). Hunt for: **landmines** (wrong-by-default data, stale denormalizations, filters that pass bad rows, escaping that corrupts output); **unwritten conventions**; **half-built or reverted prior attempts** and *why* they died (the reason is usually the landmine); **findings beyond the feature** (latent bugs the code path inherits — escalate to the map, don't silently absorb).

Report each finding as a card: **evidence** (file and line), **why it bites**, **what it changes** about the task. Worst first. A finding needing a user decision closes like a stage-2 question (lettered options + recommendation); one needing only awareness goes on the map as a sharp edge.

**Done when** the sweep has covered the code the task will touch and every finding is on the map — decided, OPEN, or noted as a sharp edge.

### 5. Hand over the map — the walk's only done-condition

Assemble the completed four-quadrant map as one self-contained artifact the user keeps (`$RESEARCH_DIR/<slug>.unknowns.md`):

- **Known knowns** — the settled ground, with file citations.
- **Known unknowns** — the decision ledger: every named question, its answer, who closed it (user / territory / OPEN). OPEN items state what unblocks them.
- **Unknown knowns** — what got extracted: taste, consumers, environment, tacit conventions, and what each reshaped.
- **Unknown unknowns** — the landmine cards with evidence, each marked decided, OPEN, or sharp-edge.

Anything still open lives on the map, not in scrollback. A **build plan may accompany the map, never replace it** — sort by likelihood-of-tweaking (judgment calls first with alternatives toggleable, mechanical work collapsed at the bottom). Add a **copyable implementation prompt** — the user's next message pre-drafted.

**Done when** the user holds the map. Offer to begin implementation as a separate task.

## After the walk

The map lives on past planning:

- **Implementation notes** (during the build) — running log; each time the code forces a deviation, record what the plan said, what the code revealed, the conservative call made. Tag entries needing the user's judgment. Each deviation is an unknown unknown that escaped the walk — fold it back for attempt #2.
- **Buy-in doc** (before shipping) — package prototype, spec, notes into one skimmable pitch: lead with a demo, pre-answer each reviewer's objection with evidence, name who signs off on what.
- **Quiz before merge** (before merging someone else's or a long diff) — merge-readiness report (mental model, non-obvious behaviors introduced, what to watch after deploy) ending in a quiz; wrong answers point back to the skimmed section.

## Rules

- Walk the quadrants in order, one stage at a time, naming the current quadrant. No map, not done.
- Stages order the walk; they never embargo information. A finding that materially bears on a decision in flight is disclosed the moment you have it, then filed under its quadrant.
- Nothing closes off-screen. Any question or judgment the map records as closed was shown to the user first — including ones the territory answered.
- Claims about the territory cite real files actually read. A fabricated specific destroys the map's authority.
- HTML artifacts are self-contained single files: inline CSS/JS, no external requests, plausible fake data over lorem ipsum.
- Never barrel into implementation on unconfirmed guesses. Implementing is a separate task that begins after the map is delivered.
