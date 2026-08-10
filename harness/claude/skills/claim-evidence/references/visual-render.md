Passing a data-injection check, a compile/lint, or "the JSON blob is embedded / the file was written" is NOT proof a visual artifact renders. It only proves the data reached the file.

Visual output fails *after* the data is correct:
- **sizing/layout** — a zero-intrinsic-size container (bare `<svg>` gets 300×150, not viewport), `overflow` clipping, coordinates drawn outside the visible box.
- **CSS** — element painted but off-screen, transparent, or behind another.
- **JS runtime error** — throws mid-script, aborting before paint; earlier DOM (headers, legends) still shows, so partial render masks total failure.

Before reporting done on visual output:
1. **Render it** — open in a browser and screenshot, or produce the image, and look. If the user can see it, ask them to confirm it displays.
2. If you cannot render it here, **state visual rendering is unverified** — don't claim "verified"/"works". Report exactly what you checked (data present, compiles) and what you did not (it displays).

A near-empty result with only chrome (title/legend) painted is the signature of a layout/coordinate bug, not a data bug — check container size and coordinate ranges first.

## A diagram embedded in a published page

A mermaid block that fails to parse does not error and does not vanish — the viewer shows the raw
source text where the picture should be, and the surrounding page looks perfectly fine. Writing the
fenced block proves nothing; only a render does.

Validate every diagram before publishing, by rendering it (the `mermaid-diagram` agent renders to
PNG for exactly this) rather than by reading the source and judging it plausible. Then write in a
dialect that has fewer ways to fail:

- Declare every node before any edge that references it. An edge to a node defined later — most
  often a `subgraph` — is a parse error.
- No `subgraph` when a `classDef` tint conveys the same grouping.
- No `<br/>` in labels; shorten the label instead.
- Plain `["…"]` rectangles over cylinder `[("…")]` and hexagon `{{"…"}}` shapes.
- Keep punctuation out of labels — `·`, em dashes, and quotes inside quoted strings.

When a diagram is reported broken, fix every risky construct at once instead of guessing which one
broke it. A second failed render costs another round trip with the reader.

**If no renderer is reachable here, say the render is unverified — do not switch the format on your
own.** With no `mmdc` installed and a sandbox that cannot install one, the honest report is "rewritten
in the conservative dialect, still unverified, tell me if it shows as text again", plus whatever you
*can* check: the markup is well-formed (an `HTMLParser` pass with no unclosed or mismatched tags) and
the block count is what you intended.

Swapping mermaid for hand-built HTML/CSS boxes removes the parser, but it also throws away the
reader's chosen format, their zoom and copy behaviour, and the diff-ability of the source. A reader
who asked for mermaid wants mermaid. Offer the substitution as a question — never as a fix you ship
because verification was inconvenient.

## A spawned window: a live process is not a visible window

`pgrep` finding the GUI process proves it started, nothing more. The user's screen is the only test.
A window can be running and unseeable because it opened on another desktop Space (a fullscreen
terminal is its own Space, so a window launched from one lands behind it), because it opened behind
the focused window, or because it is off-screen on a disconnected display.

Screenshot the whole screen and look — not the process list. On macOS, `screencapture -x <file>` plus
reading the image, and `osascript -e 'tell application "System Events" to tell (first process whose
name contains "<app>") to get name of every window'` for the window server's own answer.

When the same code was verified visually *before* a change to how it launches — foreground to
detached, direct to spawned, in-process to subprocess — that screenshot no longer covers it.
Re-screenshot after the launch path changes.
