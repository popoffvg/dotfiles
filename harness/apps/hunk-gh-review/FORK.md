# Fork of hunk-gh-review

Upstream: <https://github.com/phl28/hunk-gh-review>, forked at `d1415964`
("Set $EDITOR fallback so the built-in e key works").

Loaded from this directory by `.config/hunk/config.toml` (`[extensions] paths`). The managed
install was removed with `hunk extension remove hunk-gh-review` — two copies would both
register `S` and one would lose the key.

## Why it is forked

`S` submitted nothing for any note the reviewer had written in an earlier session.

Three facts, each verified against the running binary:

1. A `user` note can only be typed in the TUI. `session comment add` has no flag that makes
   one, and the extension API's `ExtensionReviewControls` is read-only (`snapshot()` alone).
2. Everything applied through the CLI is `source: "agent"`. Applying one note into a live
   session and listing it back showed `[agent]`, absent from `--type user`.
3. Upstream's `fetchSessionNotes` asks for `--type user`.

A Hunk session holds notes in memory and drops them when the window closes, so `prx` carries
them across runs through `prx-comments.sh restore`, which re-applies them over the CLI — as
agent notes. Upstream `S` therefore could not see the reviewer's own notes the moment they had
survived a reopen. There is no persistent-session feature to reach for instead: `hunk diff`
has no `--session-path`.

## What the fork changes

One function, `fetchSessionNotes`:

- **`--type user` → `--type all`**, then filter with `submittable()`: a note is submitted when
  its `source` is `user`, or when its `author` is `prx-restored`. The marker is what keeps a
  review gate's findings out of a human's review — widening to `all` without it would post
  them.
- **`noteAnchor()` reads `newRange`/`oldRange`**, which is how an agent note carries its
  position; a user note carries `newLine`/`oldLine`. Both changes are required together:
  widening the type alone returns notes whose line is `undefined`, and the existing
  `typeof line === "number"` guard then drops every one of them as silently as before.

`prx-comments.sh restore` stamps `author: "prx-restored"` on each comment it applies. The two
halves only work as a pair.

## Rebasing on upstream

```bash
git clone https://github.com/phl28/hunk-gh-review /tmp/ghr
diff -u /tmp/ghr/index.tsx harness/apps/hunk-gh-review/index.tsx
```

The whole fork is `fetchSessionNotes` and the two helpers above it. If upstream ever accepts a
note-source option, or Hunk grows a way to create a `user` note from outside the TUI, this fork
should be dropped rather than carried.
