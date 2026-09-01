use zed_extension_api::{self as zed, Command, LanguageServerId, Result, Worktree};

const BINARY: &str = "line-comment-lsp";

struct LineComment;

impl zed::Extension for LineComment {
    fn new() -> Self {
        LineComment
    }

    fn language_server_command(
        &mut self,
        _id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Command> {
        let env = worktree.shell_env();
        // Zed resolves PATH from the worktree shell, which does not always carry
        // ~/.local/bin — where the mise task installs the binary. The home comes from
        // that shell env too: this runs inside the wasm sandbox, where the extension's
        // own HOME is empty and the fallback would read `/.local/bin`.
        let command = match worktree.which(BINARY) {
            Some(path) => path,
            None => {
                let home = env
                    .iter()
                    .find(|(name, _)| name == "HOME")
                    .map(|(_, value)| value.as_str())
                    .ok_or_else(|| {
                        format!("line-comment: {BINARY} is not on the worktree PATH and the worktree shell env has no HOME, so ~/.local/bin cannot be tried")
                    })?;
                format!("{home}/.local/bin/{BINARY}")
            }
        };
        Ok(Command {
            command,
            args: Vec::new(),
            env,
        })
    }
}

zed::register_extension!(LineComment);
