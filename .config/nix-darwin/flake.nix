{
  description = "popoffvg's NixOS configuration";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-darwin.url = "github:LnL7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.url = "github:nix-community/home-manager";
  };

  outputs = inputs@{ self, nix-darwin, nixpkgs ,home-manager }:
  let
    username = import ./username.nix;
    configuration = { pkgs, ... }: {
      environment.variables.EDITOR = "neovim";
      # List packages installed in system profile. To search by name, run:
      # $ nix-env -qaP | grep wget
      environment.systemPackages =
       with pkgs; [
           # cli
           entr
           eza
           fzf
           zoxide
           thefuck
           grc
           zinit
           atuin
           jq
           fd
           sd
           yq
           ripgrep
           delta

           # dev env
           direnv
           nerdfonts
           tldr
           stow
           # neovim
           mise
           # tmux # should install manually
           oh-my-posh
           wezterm
           go
           kubectl
           zsh-autosuggestions
           gh
           nodejs
        ];

      # Auto upgrade nix package and the daemon service.
      services.nix-daemon.enable = true;
      # nix.package = pkgs.nix;

      # Necessary for using flakes on this system.
      nix.settings.experimental-features = "nix-command flakes";

      # Create /etc/zshrc that loads the nix-darwin environment.
      programs.zsh.enable = true;  # default shell on catalina
      # programs.fish.enable = true;

      # Set Git commit hash for darwin-version.
      system.configurationRevision = self.rev or self.dirtyRev or null;

      # Used for backwards compatibility, please read the changelog before changing.
      # $ darwin-rebuild changelog
      system.stateVersion = 4;

      # The platform the configuration will be used on.
      nixpkgs.hostPlatform = "aarch64-darwin";

      # https://github.com/LnL7/nix-darwin/issues/231
      system.checks.verifyNixPath = false;
    };
  in
  {
    # Build darwin flake using:
    # $ darwin-rebuild build --flake .#Vitaliis-MacBook-Pro
    darwinConfigurations."M-M2D0JVVDKX" = nix-darwin.lib.darwinSystem {
      modules = [
        configuration
    ];
    };

    # Expose the package set, including overlays, for convenience.
    darwinPackages = self.darwinConfigurations."M-M2D0JVVDKX".pkgs;
  };
}
