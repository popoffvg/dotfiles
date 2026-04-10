---
name: laptop-setup
description: This skill should be used when the user wants to "add a package", "install tool", "remove package", "add symlink", "add config", "update ansible", "change laptop setup", "add brew package", "add cask", or mentions modifying the dotfiles ansible playbook.
---

# Laptop Setup

Manage the dotfiles-based laptop provisioning via `ansible/install_packages.yaml`.

**Dotfiles repo:** `~/Documents/git/dotfiles`

## Architecture

All setup is declared in `ansible/install_packages.yaml`:
- `brew_packages` — CLI tools installed via Homebrew
- `brew_casks` — GUI apps installed via Homebrew Cask
- `home_symlinks` — files from dotfiles root symlinked to `$HOME`
- `config_symlinks` — dirs from `.config/` symlinked to `~/.config/`
- Tasks section — ordered setup steps (brew, symlinks, git hooks, mise, cleanup)

## Step 1: Read current playbook

```
Read ansible/install_packages.yaml
```

Understand the current vars and tasks before making changes.

## Step 2: Determine the change type

| User wants to...             | Action                                                    |
|------------------------------|-----------------------------------------------------------|
| Add a CLI tool               | Add to `brew_packages` under the right category comment   |
| Add a GUI app                | Add to `brew_casks`                                       |
| Add a dotfile to `$HOME`     | Add to `home_symlinks`, create the file in repo root      |
| Add a config dir             | Add to `config_symlinks`, create dir under `.config/`     |
| Add a setup step             | Add a new task in the tasks section, in logical order      |
| Remove a tool/app            | Remove from vars list, remove related files/symlinks/tasks |

## Step 3: Make the change

Edit `ansible/install_packages.yaml` with the minimal change needed.

### Rules

- **Categories**: brew packages are grouped by comment (`# shell`, `# tools`, `# git`, `# dev`, `# terminal`, `# apps`). Place new entries under the correct category.
- **Alphabetical within category**: keep packages sorted alphabetically within each category group.
- **One change at a time**: don't combine adding a package with restructuring the playbook.
- **Matching files**: if adding a symlink, ensure the source file/dir exists in the dotfiles repo. Create it if needed.
- **No orphans**: if removing a tool, also remove its config files, symlinks, and any related zshrc sourcing.
- **Test after change**: run `ansible-playbook ansible/install_packages.yaml --check --diff` to verify syntax.

## Step 4: Verify

```bash
# Dry-run to check for errors
ansible-playbook ansible/install_packages.yaml --check --diff -c local -i localhost,
```

## Quick reference

```bash
# Full provisioning run
ansible-playbook ansible/install_packages.yaml -c local -i localhost,

# Just install packages (skip symlinks, hooks, etc.)
ansible-playbook ansible/install_packages.yaml -c local -i localhost, --tags packages
```
