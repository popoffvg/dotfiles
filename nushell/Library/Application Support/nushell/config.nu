# config.nu — main nushell configuration

# ---------------------------------------------------------------------------
# Starship prompt
# ---------------------------------------------------------------------------
use ($nu.default-config-dir | path join 'scripts' 'starship.nu')

# ---------------------------------------------------------------------------
# Zoxide (z / zi)
# ---------------------------------------------------------------------------
source ($nu.default-config-dir | path join 'scripts' 'zoxide.nu')

# ---------------------------------------------------------------------------
# Atuin — shell history
# ---------------------------------------------------------------------------
source ($nu.default-config-dir | path join 'scripts' 'atuin.nu')

# ---------------------------------------------------------------------------
# Carapace — completions
# ---------------------------------------------------------------------------
source ($nu.default-config-dir | path join 'scripts' 'carapace.nu')

# ---------------------------------------------------------------------------
# Mise — runtime/tool manager
# ---------------------------------------------------------------------------
source ($nu.default-config-dir | path join 'scripts' 'mise.nu')

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
$env.config.buffer_editor = "hx"

# ---------------------------------------------------------------------------
# Keybindings
# ---------------------------------------------------------------------------
$env.config.keybindings = ($env.config.keybindings | append [
    {
        name: open_editor
        modifier: control
        keycode: char_o
        mode: [emacs, vi_normal, vi_insert]
        event: { send: openeditor }
    }
    {
        name: ai_suggest
        modifier: control
        keycode: char_s
        mode: [emacs, vi_normal, vi_insert]
        event: {
            send: executehostcommand
            cmd: 'let q = (commandline); if ($q | str trim | is-not-empty) { commandline edit ""; aichat -e $q }'
        }
    }
])

# ---------------------------------------------------------------------------
# Aliases
# ---------------------------------------------------------------------------
alias g = git
alias k = kubectl
alias br = broot
alias h = tldr

# ---------------------------------------------------------------------------
# Custom commands
# ---------------------------------------------------------------------------

# AI command execution via aichat
def --env ai [...query: string] {
    let q = ($query | str join " ")
    if ($q | is-empty) {
        print "Usage: ai <natural language query>"
        return
    }
    aichat -e $q
}

def pltmp [...args] {
    ^pl-db-cli --db-dir=/tmp/db ...$args
}
