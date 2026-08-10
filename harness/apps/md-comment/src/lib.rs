use zed_extension_api::{self as zed, Command, LanguageServerId, Result, Worktree};

const BINARY: &str = "md-comment-lsp";

struct MdComment;

impl zed::Extension for MdComment {
    fn new() -> Self {
        MdComment
    }

    fn language_server_command(
        &mut self,
        _id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Command> {
        // Zed resolves PATH from the worktree shell, which does not always carry
        // ~/.local/bin — where the mise task installs the binary.
        let command = worktree.which(BINARY).unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_default();
            format!("{home}/.local/bin/{BINARY}")
        });
        Ok(Command {
            command,
            args: Vec::new(),
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(MdComment);
