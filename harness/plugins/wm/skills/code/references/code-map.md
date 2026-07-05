# spec — code-map

A code map is a single-file D2 diagram rendered to SVG that lives next to
`<notes-dir>/spec.md` and lets the user sanity-check the architector's mental
model of the codebase.

Two variants:

| Variant | Nodes | Edges |
|---------|-------|-------|
| **package map** | Go packages / TS modules / Rust crates | imports + named calls between packages |
| **component map** | Types: structs, interfaces, value objects | "implements", "embeds", "uses", "constructs" |

Pick the variant the user asked for. If unclear, default to **package map** —
it's the broader, more useful starting picture.

## CRITICAL RULES

- **Output lives in `<notes-dir>/`** — never in source folders.
  - D2 source: `<notes-dir>/<name>.d2`
  - Rendered SVG: `<notes-dir>/<name>.svg`
  - **Zoomable viewer (mandatory)**: `<notes-dir>/<name>.html` — wraps the SVG
    with `svg-pan-zoom` (CDN) so the user can scroll-zoom and drag-pan.
  - Default `<name>`: `spec-packages` or `spec-components` depending on variant.
- **Layout engine: ELK, always.** Render with `d2 --layout=elk <in> <out>`.
  No `dagre`, no `tala`. ELK gives hierarchical orthogonal routing — the
  only layout that scales past ~10 nodes without visual chaos.
- **Do not touch source code.** Read-only over the repo; write only under
  `<notes-dir>/`.
- **Verify SVG exists and is non-empty** after rendering. If `d2` is missing
  or render fails, stop and report — don't substitute another tool.
- Append a one-line entry to `<notes-dir>/worklog.md` describing what was
  drawn.

## Procedure

1. **Confirm variant** (package vs component). If the user said "code map"
   without qualifier, ask once via `AskUserQuestion`; otherwise just pick
   package.
2. **Read context** — `<notes-dir>/spec.md` (Description, Goal, TODO List),
   `<notes-dir>/GLOSSARY.md`, and any prior `<notes-dir>/research-*.md`.
   `GLOSSARY.md` is the source of truth for node names.
3. **Identify nodes** — start at the entry point and follow the call graph
   outward; don't enumerate the directory tree. Find the package/type that
   handles the request the spec is about, then add what it reaches. Skip
   nodes that don't change the flow (logging, metrics, generic validators)
   unless a TODO touches them — the map is the flow, not the file census.
   - Package map: every package the spec touches plus immediate neighbours
     it depends on, plus external systems (DB, IdP, message bus).
   - Component map: every type listed in `GLOSSARY.md` with
     `Kind ∈ {entity, value-object, aggregate, component, service, policy}`.
4. **Identify edges** — for each pair of nodes, the most informative call
   or relation. Label each edge with the method / interface / event name.
   Don't draw transitive edges; keep the graph readable.
5. **Colour-code by change kind**, mirroring spec.md's TODO scope:

   | Class | Meaning | Fill / stroke |
   |-------|---------|---------------|
   | `new` | introduced by this spec | `#dcf5dc` / `#2d8a2d` |
   | `modified` | existing, behaviour changes | `#fff4c8` / `#a87800` |
   | `unchanged` | exists, behaviour stays | `#ffffff` / `#555` |
   | `external` | outside the codebase | `#eeeeee` / `#777` dashed |

6. **Write D2 source** using the template below.
7. **Render** with `d2 --layout=elk <notes-dir>/<name>.d2 <notes-dir>/<name>.svg`.
8. **Emit the zoomable HTML viewer** at `<notes-dir>/<name>.html` using the
   template below. Inline the SVG (don't `<img src>` it — `svg-pan-zoom` needs
   the SVG element in the DOM). Use `Write`, never a bash heredoc (history
   expansion mangles `<!doctype`).
9. **Verify** both the SVG and HTML exist and are non-empty (`ls -la`), then
   report paths + sizes + node/edge tables to the user.

### Zoomable HTML viewer template

Replace `__SVG_INLINE__` with the **contents of the rendered `.svg` file**
(strip the leading `<?xml ...?>` PI if present; keep the `<svg ...>` element).
The `viewBox` already on D2's SVG is what makes pan/zoom geometry work — do
not strip it.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>__TITLE__</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0a0a0a; color: #e5e7eb;
                 font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #toolbar { position: fixed; top: 8px; left: 8px; z-index: 10;
               background: rgba(0,0,0,0.6); padding: 6px 10px; border-radius: 6px;
               font-size: 12px; }
    #toolbar button { background: #262626; color: #e5e7eb; border: 1px solid #444;
                      border-radius: 4px; padding: 2px 8px; margin-right: 4px;
                      cursor: pointer; }
    #toolbar button:hover { background: #333; }
    #stage { width: 100vw; height: 100vh; }
    #stage svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <div id="toolbar">
    <button onclick="panZoom.zoomIn()">＋</button>
    <button onclick="panZoom.zoomOut()">−</button>
    <button onclick="panZoom.resetZoom(); panZoom.center()">reset</button>
    <span>scroll = zoom · drag = pan</span>
  </div>
  <div id="stage">
    __SVG_INLINE__
  </div>
  <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
  <script>
    const svg = document.querySelector('#stage svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    const panZoom = svgPanZoom(svg, {
      zoomEnabled: true, controlIconsEnabled: false,
      fit: true, center: true, minZoom: 0.2, maxZoom: 20,
      mouseWheelZoomEnabled: true, dblClickZoomEnabled: true,
    });
    window.panZoom = panZoom;
    window.addEventListener('resize', () => { panZoom.resize(); panZoom.fit(); panZoom.center(); });
  </script>
</body>
</html>
```

> Implementation note: read the rendered `.svg` file, find the `<svg`
> opening tag (drop any XML PI before it), and splice the entire `<svg
> ...>...</svg>` block in place of `__SVG_INLINE__`. Title field is
> the spec/ticket name.
>
> **Bash trap**: never assemble this HTML through a bash heredoc or `bash -c`
> — history expansion mangles `<!doctype` to `<\!doctype` and the file ceases
> to be HTML. Use the registered helper:
> `python3 ~/.claude/scripts/build-zoom-html.py <svg-in> <html-out> "<title>"`
> (script is logged in `~/.claude/scripts/MANIFEST.md` as
> `build-zoom-html.py`). Always check `head -c 16 <html-out>` prints
> `<!doctype html>` exactly.

## D2 template

```d2
# <Spec ticket> — <variant> map
# Layout: ELK. Render: d2 --layout=elk <in> <out>

direction: right

classes: {
  new:       { style: { fill: "#dcf5dc"; stroke: "#2d8a2d"; stroke-width: 2 } }
  modified:  { style: { fill: "#fff4c8"; stroke: "#a87800"; stroke-width: 2 } }
  unchanged: { style: { fill: "#ffffff"; stroke: "#555";    stroke-width: 1 } }
  external:  { style: { fill: "#eeeeee"; stroke: "#777";    stroke-width: 2; stroke-dash: 4 } }
}

# Group related nodes in containers (e.g. all util/oidc/* under one box).
group_name: "Container label" {
  style: { stroke: "#888"; stroke-dash: 3; fill: "#fafafa" }
  node_id: "node label" { class: new }
}

# Top-level nodes
some_pkg: "platform/auth\n(SSO, LoginResult)" { class: modified }

# External systems
db: "RocksDB" { class: external }

# Edges (one per real call/relation, labelled)
some_pkg -> group_name.node_id: "Method.Call(args)"

# Legend block — keep at bottom-right
legend: "Legend" {
  near: bottom-right
  shape: rectangle
  grid-columns: 1
  l_new: "NEW"        { class: new }
  l_mod: "MODIFIED"   { class: modified }
  l_unc: "UNCHANGED"  { class: unchanged }
  l_ext: "EXTERNAL"   { class: external }
}
```

## Component-map specifics

When variant = component:

- Nodes are types (e.g. `SSO struct`, `SSOAuthenticator interface`,
  `LoginResult value-object`).
- Edge labels: `implements`, `embeds`, `constructs`, `calls
  Method`, `emits Event`.
- Use D2 `shape: class` for struct-like nodes if you want to list fields —
  but keep it sparse: 3-5 fields max per node.
- Group by package using containers; that makes the package layer legible
  alongside the type layer.

## Report

After rendering, reply with:

- Both file paths + sizes (`ls -la` output).
- A two-column table of nodes (name → class).
- A three-column table of edges (from → to → label).
- Any edge you weren't sure about, framed as a question — don't silently
  guess.

## Updating an existing map

Re-run the skill — overwrite the `.d2` and re-render the `.svg`. Don't keep
old versions; the `.d2` source is the single source of truth and lives
beside the spec it describes.

## Limits

- ≤ 25 nodes for ELK to keep routes clean. Beyond that, split into two maps
  (e.g. one map per subsystem) or move to a flow-map (the `explore-flow-map` skill).
- ≤ 4 edges per node label band. If a node has more, the most likely problem
  is that it should be split into two nodes.
