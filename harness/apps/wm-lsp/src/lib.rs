use zed_extension_api::{self as zed, Command, LanguageServerId, Result, Worktree};

const BINARY: &str = "wm-lsp";

struct WmNotes;

impl zed::Extension for WmNotes {
    fn new() -> Self {
        WmNotes
    }

    fn language_server_command(&mut self, _id: &LanguageServerId, worktree: &Worktree) -> Result<Command> {
        let env = worktree.shell_env();
        // The wasm sandbox has an empty HOME, so ~/.local/bin is built from the worktree shell env.
        let command = match worktree.which(BINARY) {
            Some(path) => path,
            None => {
                let home = env
                    .iter()
                    .find(|(name, _)| name == "HOME")
                    .map(|(_, value)| value.clone())
                    .ok_or_else(|| format!("{BINARY} is not on the worktree PATH, and the worktree shell env has no HOME"))?;
                format!("{home}/.local/bin/{BINARY}")
            }
        };
        Ok(Command { command, args: Vec::new(), env })
    }
}

zed::register_extension!(WmNotes);
