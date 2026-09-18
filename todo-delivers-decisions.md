# TODO "what it brings" list — 3 decisions

You asked to add a list to the human half of a wm TODO (`todos/TODO-N.md`). The list names what the TODO brings, for example "package public method", "state machine".

The human half today has these sections in order: Outcome, New terms, Components, Surface, Autotest, Commit. The rules and the filled specimen live in `harness/plugins/wm/skills/arch/examples/todo.md`.

Write your choice on each `**Answer:**` line. An empty line means you agree with the recommendation.

---

### 1. Where does the list go?

- **Source:** `harness/plugins/wm/skills/arch/examples/todo.md:49` (the Outcome section)
- **Original:** > let's add to TODO in human part the item list carries what todo brings. For example: package public method, state machine, and so on
- **Detail:** Pick the place in the file. Two sections near it already exist. `## Outcome` says what a user can do. `## Components` lists the symbols the TODO touches, with a `Type` column that names the brick (command, service, flow, gateway, server, consumer, policy, scheduler, wiring).

  | Option | Where | What it costs |
  | --- | --- | --- |
  | A — new `## Delivers` section | Between Outcome and New terms | One more section to write and to lint |
  | B — bullets inside `## Outcome` | Under the Outcome prose | Outcome mixes capability language with symbol names, which the section bans today |
  | C — new column in `## Components` | One item per component row | Ties each item to one symbol; a state machine that spans two symbols has no row |

  Layout of option A

  ```
  ## Outcome
  A `User` can issue `RotateToken` …

  ## Delivers

  - public method `pkg/auth.Handler.Refresh` — exchanges a refresh token for a new pair
  - state machine `Session` — active → rotated → revoked
  - config key `auth.refresh_ttl` — default 15m

  ## New terms
  ```

- **Recommended:** A

  The Outcome section bans symbol names today, so option B breaks a rule that is there on purpose. Option C ties every item to exactly one component row, and a state machine or a protocol often spans two. A separate section costs one heading and keeps both existing rules intact.

**Answer:** A

---

### 2. Is the item kind a closed set or free text?

- **Source:** `harness/plugins/wm/skills/arch/examples/todo.md:120` (the `Type` column rule, which uses a closed roster)
- **Original:** > For example: package public method, state machine, and so on
- **Detail:** Decide if each bullet must start with a kind from a fixed roster. The `Type` column in `## Components` already works this way: nine bricks, and a component that fits none is a signal to split the TODO.

  | Option | Form of a bullet | What it costs |
  | --- | --- | --- |
  | A — closed roster | `public method \`X\` — <one clause>` | Someone must keep the roster right; a real item that fits no kind is blocked |
  | B — free text | `<any noun phrase> — <one clause>` | No lint check is possible; two TODOs name the same kind two ways |

  A first roster for option A: public method, public type, state machine, event, endpoint, config key, CLI flag, schema or migration, script.

- **Recommended:** A

  A free list drifts into a second Components table written in prose. A roster makes the section scannable and makes a lint check possible later. If an item fits no kind, that is the same signal the brick roster gives: the TODO does more than one thing.

**Answer:** B, it's a tip for reviewer what he should read

---

### 3. Does the section stay mandatory?

- **Source:** `harness/plugins/wm/skills/arch/commands/sub-todo.md` (§ Required elements)
- **Detail:** Decide what a TODO with nothing to list writes. A pure refactor adds no public method and no state machine.

  | Option | A TODO with nothing to list | What it costs |
  | --- | --- | --- |
  | A — optional | Omits the whole section, same as `## New terms` today | The reader cannot tell "nothing to list" from "the author forgot" |
  | B — mandatory | Writes one line: `none — <reason>`, same as the Autotest levels | One more forced line on a refactor TODO |

- **Recommended:** A

  `## New terms` already works this way in the same file, so the reader learns one rule, not two. A TODO that brings no public surface is rare and its Outcome already says "no new capability".

**Answer:** B
