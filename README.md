# dotfiles

Settings for workspace.

For managing dotfiles, stow is used. The path to the repositories should be the same as in the `~` directory.

## install

```sh
nix run nix-darwin -- switch --flake .config/nix-darwin
stow -t ~ .

```

## prerequests

- nix

## nix installation

```
nix run nix-darwin -- switch --flake .config/nix-darwin


```
