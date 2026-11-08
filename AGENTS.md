read CLAUDE.md

## Cursor Cloud specific instructions

This tree is personal dotfiles (GNU Stow + mise) plus small harness apps. `ansible/install_packages.yaml` and `install.sh` provision a Mac (nanobrew, Homebrew casks, nix-darwin). They are not the Cloud Agent setup path.

The environment install provides Stow 2.4.1, `shellcheck`, mise, Go 1.25.9, and Neovim on `/usr/local/bin`, and Rust 1.85 or newer (the image's 1.83 cannot build `zed_extension_api` 0.7). Node is on the base image. `/usr/bin/go` is older than `harness/apps/self-improve`; use `/usr/local/bin/go`. Ubuntu's Stow 2.3.1 fails on `dot-config/` with `stow_contents() called with non-directory path`.

Checks from the repo root:

- `mise run harness:plugins:sync` regenerates `.claude-plugin/marketplace.json`.
- `mise run stow` links this checkout into `$HOME`. The root package name is the checkout directory's basename. The install creates `~/.claude` and `~/.pi/agent` as real directories first; those are the harness stow targets. Project `.claude` is ignored by the root package so it does not fold over `~/.claude`. The git package then aborts: `~/.gitconfig` is the Cloud Agent credential file and must stay a regular file. Link the rest of that package with `stow --dotfiles --ignore='^dot-gitconfig$' --target=$HOME --dir=<repo> --stow git`.
- `go test ./... -count=1` in `harness/apps/self-improve`. `mise run harness:self-improve:build` installs the TUI at `~/.local/bin/self-improve` (`self-improve --version`).
- `cargo test -p line-comment-server` in `harness/apps/line-comment`. One test, `a_shutdown_before_initialize_ends_the_process`, fails on current code: the process writes the `Content-Length` header and exits before the body. The other tests pass, and the `comment` / `list` / `drop` subcommands work.
- `npm test` in `harness/apps/mdshow`. `node bin/mdshow.js show <file.md> --print-html` renders a page without opening a window.

