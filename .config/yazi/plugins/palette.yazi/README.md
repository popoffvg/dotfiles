# palette.yazi

**A command palette for Yazi, bound to `Ctrl-P` / `Ctrl-Shift-P`.** Type part of
what a command does, read the description, press Enter to run it — the same move
as `Ctrl-Shift-P` in Zed or VS Code. Each row shows the description, the command
Yazi will run, and the key that already triggers it, so the palette teaches the
keys while you use it.

**The command list comes from Yazi's own keymap.** Yazi has no API that reports
its commands, but every keymap binding already carries a `run` and a `desc` —
that is the list. `gen-catalog.py` reads the default keymap out of the `yazi`
binary (it is compiled in, not installed on disk), merges `~/.config/yazi/keymap.toml`,
drops the duplicates, and writes the result into `main.lua` between the CATALOG
markers. Your own bindings win over the defaults and appear first.

**Regenerate after you upgrade Yazi or change your keymap.**

```sh
./gen-catalog.py
```

**Needs `fzf` on PATH.** The palette hides Yazi, hands the rows to `fzf` for the
fuzzy match, and emits the chosen command when `fzf` exits. `Esc` cancels and
changes nothing.
