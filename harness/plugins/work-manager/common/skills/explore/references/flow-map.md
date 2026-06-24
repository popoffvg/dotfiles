# Explore › flow-map — render interactive flows HTML

`/explore flow-map [path to flows.json]` — defaults to `$RESEARCH_DIR/flows.json`
(the `workflow` subcommand's aggregated output).

## Purpose

Produce one **self-contained HTML file** that:

1. Lays out every package/component in **swimlane columns** by `kind` on a dark canvas (ToDesktop-style architecture diagram).
2. Lists named actions ("flows") in a sidebar. Clicking a flow:
   - dims non-participating packages,
   - highlights participants with a colored border in the column's tint,
   - draws ordered edges between them with **numbered yellow step circles**,
   - fills a STEPS panel with each edge's payload + source `path:line`.
3. Works offline after first load (one CDN script for Cytoscape, no build step).

Input: a JSON document. Output: a single `.html` file.

## Input JSON schema

```jsonc
{
  "title": "MyApp — Architecture & Flows",
  "packages": [
    {
      "id": "web",                       // unique slug used in edges
      "label": "Web Frontend",           // node title
      "sub":   "apps/web",               // optional 2nd line under title
      "kind":  "actor|client|codebase|sdk|backend|external",
      "description": "..."               // shown in tooltips / steps if you add it
    }
  ],
  "flows": [
    {
      "id": "invite-user",
      "label": "Invite new user",
      "description": "...",
      "edges": [
        {
          "from": "web", "to": "api",
          "via": "POST /invites",                  // transport label
          "payload": "{ email, role }",            // 1-line summary
          "source": "apps/web/src/Invite.tsx:84",  // verifiable path:line
          "notes":  "..."                          // optional caveat
        }
      ]
    }
  ]
}
```

`edges[]` order is the temporal step sequence — the renderer numbers them `1, 2, 3, …`.

### Recommended `kind` taxonomy (drives swimlane columns)

| `kind`     | Column label             | Tint      |
| ---------- | ------------------------ | --------- |
| `actor`    | ACTORS                   | `#fbbf24` |
| `client`   | CLIENT SURFACE           | `#60a5fa` |
| `codebase` | BLOCK / FUNCTION CODEBASE| `#34d399` |
| `sdk`      | SDK / LIB                | `#a78bfa` |
| `backend`  | BACKEND PIPELINE         | `#f97316` |
| `external` | EXTERNAL SERVICES        | `#f87171` |

Free to extend — just pick a hex tint and a header label per new kind.

## Output

Default path `<input-dir>/index.html` next to the source JSON (or
`${TMPDIR%/}/claude-flow-map/<basename>.html` if input is outside a project).

## Procedure

1. **Resolve input.** If user didn't pass a path, default to `$RESEARCH_DIR/flows.json`
   (else the newest `flows.json` under the notes research dir).
2. **Validate.** Every `edge.from`/`edge.to` resolves to a known `package.id`.
   Every `flow.id` is unique.
3. **Pick output path.** `mkdir -p` if needed.
4. **Write the HTML directly using the `Write` tool.**
   **Do NOT generate the HTML through a bash heredoc** — see the bash trap below.
5. Print the absolute output path. `open` on macOS may fail under sandbox; tell
   the user to open the file manually if it does.

## CRITICAL — bash traps that ruined past runs

### `!` history expansion mangles `<!doctype`

Bash performs history expansion on `!` even **inside single-quoted heredocs**
on some setups. Result: every `<!` becomes `<\!`, the browser stops parsing the
file as HTML, and you get a blank page with literal `<\!doctype html>` text at
the top.

**Fix:** never write the HTML through `bash << 'EOF'` or `python3 -c "..."`
piped through bash. Build the full HTML string in memory and pass it to the
`Write` tool. The Write tool bypasses the shell — bytes land verbatim.

Sanity-check after writing:

```bash
head -c 16 path/to/index.html   # must print: <!doctype html>
```

### `</` inside an inlined JSON string closes the `<script>` tag

When embedding a JSON literal between `<script>` tags, any `</` substring in
your data terminates the script element. Either:

- Inline the data as a **JS object literal** (write `{ … }` directly, not a
  JSON string), or
- JSON-stringify and replace `</` → `<\/` in the resulting string.

The first form is what this skill uses.

### Other gotchas

- **0-height canvas.** A nested CSS grid needs `min-height:0` on its row track
  and `min-height:300px` on `#cy` or Cytoscape draws nothing.
- **Function-valued styles.** `'background-color': ele => …` is brittle across
  Cytoscape versions. Precompute the color into node data and use
  `'background-color': 'data(color)'`.
- **CDN drift.** Pin the version: `cytoscape@3.30.2`.
- **`open` fails under the agent sandbox.** That's not your bug; just print the
  path.

## Implementation reference (proven template)

The skill's HTML is built around these ideas (paste/adapt — keep ~300 lines):

- **Layout**: CSS Grid, two columns — `1fr 340px`. Left = canvas, right = sidebar.
- **Theme**: dark (`#0a0a0a` bg, `#e5e7eb` text, `#fbbf24` accent, `#262626`
  borders).
- **Cytoscape**:
  - One **compound node per column** (`kind`), styled with a dashed border, a
    small uppercase header label colored in the column tint, and
    `compound-sizing-wrt-labels: include`.
  - Each package node has `parent: <column-id>`, fixed `position: { x, y }`,
    `layout: { name: "preset" }`. Columns auto-size to fit.
  - Edges use `curve-style: unbundled-bezier` with `control-point-distances`
    for the curved orange look. `target-arrow-shape: triangle`.
  - **Numbered step bubbles** = edge label with
    `text-background-color: #fbbf24`, `text-background-shape: round-rectangle`,
    `text-background-padding: 4px`, plus a dark `text-border` for contrast.
  - Self-loops: add `.loop` class with `loop-direction` / `loop-sweep`.
- **Sidebar**:
  - Top half: button per flow. Active button gets the yellow accent border.
  - Bottom half: numbered list. Each step row = `<div class="num">N</div>` + a
    block with `from → to`, the `via` label, payload (monospace), source
    (smaller monospace), and notes (in `#fde68a`).
- **Behavior**:
  - On flow select: `cy.edges().remove()`, recompute participants set, toggle
    `.hot` / `.dimmed` on package nodes, add edges with `num: String(i+1)`,
    re-render the STEPS panel.
  - Default selection: the cross-cutting "end-to-end" flow if present;
    otherwise the first flow.

A complete working copy lives at
`~/Documents/git/mil/tasks/MILAB-6225-identity-propogation/.notes/<input-dir>/index.html`
— copy-paste and swap the data block when bootstrapping new diagrams.

## Update / re-render

Re-run the subcommand — it overwrites the previous HTML in place. The JSON beside
it (`flows.json`) is the source of truth; keep them next to each other so the
user can edit JSON and re-render.

## Limits

- Sweet spot: ≤ 30 packages, ≤ 8 flows, ≤ 12 edges per flow.
- Beyond that, swimlane Y-positions need manual tuning (consider auto-spacing
  children within each compound column by `flow.edges` participation order).
- The `payload` field is a 1-line summary by design. Long structures belong in
  the linked `source`.
