# code — diff

Show what changed as **one self-contained HTML page**, opened after writing. Two nodes:

| Node | Diffs | Source of the delta |
|------|-------|---------------------|
| `diff arch` *(default)* | current architecture **vs** proposed architecture | `spec.md` + code as it stands |
| `diff impl` | what the branch shipped | `git diff <target>...<current-branch>` |

Both render the **same page shape** (below). `arch` diffs a plan; `impl` diffs a commit range.

## Output: one HTML page

Write `<notes-dir>/spec-diff.html` (or `impl-diff-<sha>.html` for `diff impl`), then `open` it. Author it with the **Write tool** — never a bash heredoc (history expansion mangles `<!doctype`). Inline everything (SVG, CSS); no CDN. When a graph's SVG is small, also inline it into the markdown report so it renders in-place.

The page has up to three stacked sections, each headed by a **mono commit line** (`<sha> · <subject>`):

1. **Before / After architecture panels** — two delta-coloured box graphs, stacked, in rounded panel cards. Titled `Before: <one-line framing of the problem>` and `After: <one-line framing of the fix>`.
2. **Interfaces and signatures, rendered as diffs** — each changed type/signature as a code block with a `NEW` / `CHANGED` / `REMOVED` badge and diff-row highlighting.
3. (`diff impl` only) **Per-file change intent** — one line each: what changed, why, which TODO.

Emit only the sections that carry signal. A local one-function change needs no arch panel — say so and skip it.

## `diff arch` *(default)*

1. **Read context** — `<notes-dir>/spec.md`, `GLOSSARY.md`, prior maps. The TODO scope is the delta.
2. **Build two graphs** — `current` and `proposed` — following `references/code-map.md` steps 3–4 (entry point outward, one labelled edge per real call). D2 source, ELK layout.
3. **Colour by delta** — `code-map.md` classes plus `removed`:
   - `new` proposed-only · `modified` behaviour changes · `removed` current-only · `unchanged` · `external`.
   - Highlight the *problem* node in the current graph as `removed`/`modified` (the thing the spec deletes or splits), and the *fix* nodes in the proposed graph as `new`.
4. **Render** each: `d2 --layout=elk <notes-dir>/arch-before.d2 <notes-dir>/arch-before.svg` (and `-after`).
5. **Assemble the page** from the template below — splice both `<svg>` blocks into the two panels.
6. **Signatures section** — for every type/interface the spec adds or changes, add a badge block (see template). This is where "function signatures, etc." land.
7. **Open** — `open <notes-dir>/spec-diff.html`.

## `diff impl`

1. **Resolve the target branch** — the PR base, else `main`. Confirm if ambiguous.
2. `git diff --stat <target>...<current-branch>` for the census, `git diff <target>...<current-branch>` for hunks.
3. **Arch panels** — if packages/types/seams moved, build `before`/`after` graphs *from the diff* (before = target, after = current). Skip when the diff is local; say so.
4. **Signatures section** — every changed exported type/signature as a badge diff block, real before/after lines from the diff.
5. **Per-file intent** — one line each, mapped to TODOs.
6. **Open** the page.

## Rules

- **Read-only over source.** Write only under `<notes-dir>/`. Route real fixes to `/code fix`.
- Reuse `references/code-map.md` for D2 classes, ELK, and the ≤25-node / ≤4-edges-per-node limits. Don't reinvent graph rendering.
- **No mermaid.** D2 → SVG for graphs; HTML/CSS for the shell and signature diffs.
- Author the HTML with **Write**, inline all assets, then `open` it.
- If `d2` is missing or a render fails, stop and report — don't substitute another tool.

## HTML template

Splice rendered SVGs in place of `__SVG_BEFORE__` / `__SVG_AFTER__` (drop any leading `<?xml?>`, keep `<svg …>`). Repeat `.sig` blocks per changed signature. Drop sections that carry no signal.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  :root {
    --bg:#faf9f6; --card:#fff; --ink:#1a1a1a; --mut:#6b7280; --line:#e5e7eb;
    --new-bg:#dcf5dc; --new-bd:#2d8a2d; --mod-bg:#fff4c8; --mod-bd:#a87800;
    --rem-bg:#f8dcdc; --rem-bd:#a82d2d; --badge-new:#4b3fbf; --badge-new-bg:#eceafe;
  }
  @media (prefers-color-scheme:dark){
    :root{ --bg:#0f0f0f; --card:#171717; --ink:#e5e7eb; --mut:#9ca3af; --line:#2a2a2a; }
  }
  html,body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{max-width:1100px;margin:0 auto;padding:32px 24px 64px}
  .commit{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mut);margin:0 0 4px}
  h2{font-size:22px;font-weight:700;margin:32px 0 12px}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:14px;
    padding:20px;position:relative;overflow:hidden;min-height:320px;touch-action:none}
  .panel svg{max-width:100%;height:auto;display:block;margin:0 auto;
    transform-origin:0 0;cursor:grab}
  .zoombar{position:absolute;top:10px;right:12px;display:flex;gap:4px;z-index:2}
  .zoombar button{width:28px;height:28px;border:1px solid var(--line);border-radius:6px;
    background:var(--card);color:var(--ink);font-size:15px;line-height:1;cursor:pointer}
  .zoombar button:hover{background:var(--mod-bg)}
  .zoombar button.reset{width:auto;padding:0 8px;font-size:11px}
  .sig{border:1px solid var(--line);border-radius:12px;margin:14px 0;overflow:hidden}
  .sig-head{display:flex;align-items:center;gap:10px;padding:12px 14px;
    font:14px ui-monospace,Menlo,monospace}
  .badge{font:600 11px/1 -apple-system,sans-serif;letter-spacing:.04em;
    padding:5px 9px;border-radius:999px}
  .badge.new{color:var(--badge-new);background:var(--badge-new-bg)}
  .badge.changed{color:var(--mod-bd);background:var(--mod-bg)}
  .badge.removed{color:var(--rem-bd);background:var(--rem-bg)}
  pre{margin:0;padding:12px 0;overflow-x:auto;background:var(--card);
    font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
  pre .ln{display:inline-block;width:2ch;color:var(--mut);user-select:none;margin-right:1.5ch}
  pre .add,pre .del,pre .ctx{display:block;padding:2px 14px}
  pre .add{background:var(--new-bg);box-shadow:inset 3px 0 var(--new-bd)}
  pre .del{background:var(--rem-bg);box-shadow:inset 3px 0 var(--rem-bd)}
</style>
</head>
<body>
<main>
  <p class="commit">__SHA__ · __SUBJECT__</p>

  <h2>Before: __PROBLEM_FRAMING__</h2>
  <div class="panel"><div class="zoombar"><button data-z="in">＋</button><button data-z="out">−</button><button class="reset" data-z="reset">reset</button></div>__SVG_BEFORE__</div>

  <h2>After: __FIX_FRAMING__</h2>
  <div class="panel"><div class="zoombar"><button data-z="in">＋</button><button data-z="out">−</button><button class="reset" data-z="reset">reset</button></div>__SVG_AFTER__</div>

  <h2>Interfaces and signatures, rendered as diffs</h2>

  <div class="sig">
    <div class="sig-head"><span class="badge new">NEW</span> TerminalStatusBarContent · types.ts</div>
    <pre><span class="add"><span class="ln">1</span>export type TerminalStatusBarContent =</span></pre>
  </div>

  <div class="sig">
    <div class="sig-head"><span class="badge changed">CHANGED</span> TerminalStatusBarContext · types.ts</div>
    <pre><span class="del"><span class="ln">2</span>  mode: TerminalPermissionMode | null</span><span class="add"><span class="ln">2</span>  content: TerminalStatusBarContent</span></pre>
  </div>
</main>
<script>
// Self-contained pan/zoom — buttons zoom, drag pans. No CDN, no scroll-wheel zoom.
document.querySelectorAll('.panel').forEach(panel => {
  const svg = panel.querySelector('svg'); if (!svg) return;
  let s = 1, x = 0, y = 0, drag = false, px = 0, py = 0;
  const apply = () => { svg.style.transform = `translate(${x}px,${y}px) scale(${s})`; };
  const zoom = f => {  // zoom toward panel centre
    const r = panel.getBoundingClientRect(), ox = r.width / 2, oy = r.height / 2;
    const ns = Math.min(20, Math.max(0.2, s * f));
    x = ox - (ox - x) / s * ns; y = oy - (oy - y) / s * ns; s = ns; apply();
  };
  panel.querySelectorAll('.zoombar button').forEach(b => b.addEventListener('click', () => {
    const z = b.dataset.z;
    if (z === 'in') zoom(1.2); else if (z === 'out') zoom(1/1.2);
    else { s = 1; x = 0; y = 0; apply(); }
  }));
  panel.addEventListener('mousedown', e => { if (e.target.closest('.zoombar')) return; drag = true; px = e.clientX; py = e.clientY; svg.style.cursor = 'grabbing'; });
  window.addEventListener('mouseup', () => { drag = false; svg.style.cursor = 'grab'; });
  window.addEventListener('mousemove', e => { if (!drag) return; x += e.clientX - px; y += e.clientY - py; px = e.clientX; py = e.clientY; apply(); });
});
</script>
</body>
</html>
```
