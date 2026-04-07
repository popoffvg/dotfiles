# dotfiles

Settings for workspace.

For managing dotfiles, stow is used. The path to the repositories should be the same as in the `~` directory.

## install

```sh
nix run nix-darwin -- switch --flake .config/nix-darwin
stow -t ~ .

```

## git-agent-review

Terminal workflow for reviewing AI-agent commits and leaving `@agent` comments in Helix.

```
git-agent-review           # pick commits → pick files → open in hx
git-agent-review --staged  # staged files only
git-agent-review --all     # working-tree changes
```

**Keyboard flow:**
1. Run `git-agent-review` (or press `Space-r` inside Helix)
2. `TAB` to multi-select commits, `ENTER` to confirm
3. `TAB` to multi-select files, `ctrl-p` diff / `ctrl-o` full file preview, `ENTER` to open
4. In Helix: navigate to the relevant line, add an `@agent` comment, save (`:w`), repeat

**Comment convention:**

| Language | Comment |
|---|---|
| Go / Rust / TS / JS / C | `// @agent: <instruction>` |
| Python / Shell / YAML | `# @agent: <instruction>` |
| SQL | `-- @agent: <instruction>` |
| HTML / XML | `<!-- @agent: <instruction> -->` |

**Helix keybindings** (in `config.toml`):
- `Space-r` — commit picker → file picker
- `Space-R` — staged files only

**Dependencies:** `fzf`, `bat`, `delta`, `hx`

## prerequests

- nix

## nix installation

```
nix run nix-darwin -- switch --flake .config/nix-darwin


```
