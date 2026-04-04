# env.nu — loaded before config.nu

# Homebrew
$env.PATH = ($env.PATH | split row (char esep) | prepend "/opt/homebrew/bin" | prepend "/opt/homebrew/sbin")

# Go
$env.PATH = ($env.PATH | split row (char esep)
    | append "/usr/local/go/bin"
    | append $"(^go env GOPATH)/bin"
)

# Rust/Cargo
$env.PATH = ($env.PATH | split row (char esep) | append $"($env.HOME)/.cargo/bin")

# Bun
$env.BUN_INSTALL = $"($env.HOME)/.bun"
$env.PATH = ($env.PATH | split row (char esep) | prepend $"($env.BUN_INSTALL)/bin")

# LM Studio
$env.PATH = ($env.PATH | split row (char esep) | append $"($env.HOME)/.lmstudio/bin")

# Antigravity
$env.PATH = ($env.PATH | split row (char esep) | append $"($env.HOME)/.antigravity/antigravity/bin")

# Windsurf / Codeium
$env.PATH = ($env.PATH | split row (char esep) | append $"($env.HOME)/.codeium/windsurf/bin")

# ~/local/bin
$env.PATH = ($env.PATH | split row (char esep) | append $"($env.HOME)/local/bin")

# Secrets from macOS Keychain
$env.GEMINI_API_KEY = (^security find-generic-password -a $env.USER -s "GEMINI_API_KEY" -w)
$env.OPENROUTER_KEY = (^security find-generic-password -a $env.USER -s "OPENROUTER_KEY" -w)

# Misc
$env.FZF_DISABLE_KEYBINDINGS = "1"
$env.CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD = "1"
