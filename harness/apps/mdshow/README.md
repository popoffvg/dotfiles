# mdshow

Show one or more markdown files in a native window, collect inline annotations, print the feedback for
a coding agent. The Claude Code side is the `show` plugin (`harness/plugins/show`), which adds
`/show <files or a prompt naming them>`.

Modelled on [`badlogic/pi-diff-review`](https://github.com/badlogic/pi-diff-review): a real OS window
through [`glimpseui`](https://github.com/hazat/glimpse), no browser tab and no local server.

## Install

```sh
cd harness/apps/mdshow
npm install
npm link          # puts `mdshow` on PATH
```

Then install the plugin from the `local-plugins` marketplace, or run Claude Code with
`claude --plugin-dir ~/git/dotfiles/harness/plugins/show`.

## Use

```sh
mdshow show notes/spec.md                     # open the window, wait as long as it takes, print feedback
mdshow show notes/spec.md notes/plan.md       # several files in one window, one round of feedback
mdshow wait --last                            # pick the newest open window back up
mdshow wait <session-id>                      # or name the session
mdshow show notes/spec.md --print-html        # page HTML only, no window (for debugging)
```

In the window: click any block to comment on it, mark the comment **FIX** (change this) or
**DISCUSS** (explain this), write an optional overall note, then `⌘⏎` to send or `esc` to close
without feedback.

Several files share one window and one submit, because the reader's answer is one round of feedback
per turn, not one per file. The header carries a file selector — each entry shows the path, a `✓` when
the file is marked reviewed, and its comment count — plus a **Mark reviewed** button (`⌘⇧R`) for the
file on screen. `⌘⌥←→` steps through the files, and each file keeps its own scroll position. The
comment list on the right holds every comment from every file; clicking one jumps to its file and
block. Every comment names its own file in the feedback, so one numbered list can point at two files:

```
## Change these

1. notes/spec.md:3-5
   > The service retries a failed upload twice, then gives up.
   Add exponential backoff between attempts.
2. notes/plan.md:3
   Say what the metrics change is.
```

The reviewed marks come back as their own section:

```
## Marked reviewed

Done with: notes/spec.md.
Not marked reviewed: notes/plan.md. Treat that file as unfinished, not approved.
```

A tick is a claim about the reader's own reading, not about the file being comment-free: a ticked file
with comments is finished, and an unticked file with no comments is **not** approved.

One unreadable path fails the whole call: a partial set would let the reader review the wrong thing
without knowing a file is missing.

## If no window appears

The window opens floating, above other windows, on the desktop Space that was active when it
launched. A **fullscreen terminal is its own Space**, so a window opened from there lands on the
Space behind it and is invisible until you leave fullscreen or click the `glimpse` icon in the Dock.
The process is running either way — `pgrep -fl "glimpse --width"` shows it.

`mdshow show --no-floating` turns the always-on-top behaviour off.

## Why the wait is split in two

A Claude Code skill injects context by running a shell command with `` !`...` ``, and that command is
killed at 120 s — measured, not assumed: a 150 s injection returned
`Command did not complete within its 120s timeout and was moved to the background`, while the same
injection under `BASH_DEFAULT_TIMEOUT_MS=600000` completed.

So the window does not live in the injected process. `show` spawns a detached `serve` process that
owns the window and writes its result to a session file in `$TMPDIR/mdshow-<user>/`. `show` waits for as long as the reader needs. If the
call is cut short at 120 s, the window stays open and `mdshow wait --last` picks it back up.

## Layout

| Path | Role |
| --- | --- |
| `bin/mdshow.js` | CLI: `show`, `wait`, and the internal `serve` |
| `src/blocks.js` | splits markdown into annotatable blocks with 1-based line ranges |
| `src/render.js` | dependency-free markdown → HTML, so the window works offline |
| `src/page.js` | builds the document bundle and inlines payload, style and script into one page |
| `src/feedback.js` | turns a submission into the text the agent reads |
| `src/session.js` | session files and the resumable wait |
| `web/` | the window itself: `page.html`, `style.css`, `app.js` |

## Test

```sh
npm test
```
