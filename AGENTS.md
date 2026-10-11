read CLAUDE.md

## Cursor Cloud specific instructions

This tree is personal dotfiles (GNU Stow + mise) plus small harness apps. `ansible/install_packages.yaml` and `install.sh` provision a Mac (nanobrew, Homebrew casks, nix-darwin). They are not the Cloud Agent setup path.

The environment install provides `stow`, `shellcheck`, mise, Go 1.25.9, and Neovim on `/usr/local/bin`. Rust and Node are on the base image. `/usr/bin/go` is older than `harness/apps/self-improve`; use `/usr/local/bin/go`.

Checks from the repo root:

- `mise run harness:plugins:sync` regenerates `.claude-plugin/marketplace.json`.
- `mise run stow` links this checkout into `$HOME`. The root package name is the checkout directory's basename.
- `go test ./... -count=1` in `harness/apps/self-improve`. `mise run harness:self-improve:build` installs the TUI at `~/.local/bin/self-improve` (`self-improve --version`).
- `cargo test -p line-comment-server` in `harness/apps/line-comment`. `line-comment-lsp` also has shell subcommands (`comment`, `list`, `drop`).
- `npm test` in `harness/apps/mdshow`. `node bin/mdshow.js show <file.md> --print-html` renders a page without opening a window.

