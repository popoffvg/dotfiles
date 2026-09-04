//! Bringing a path up in the editor already on screen, from outside any buffer.
//!
//! The server reveals a hand-over this way because `window/showDocument` is a request Zed
//! leaves unanswered. The `add` subcommand reveals one this way because it has no client
//! at all.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

/// Where the Zed CLI sits when the PATH does not name it.
const ZED_CLI_PATHS: [&str; 3] = [
    "/usr/local/bin/zed",
    "/opt/homebrew/bin/zed",
    "/Applications/Zed.app/Contents/MacOS/cli",
];

/// The Zed CLI: `LINE_COMMENT_ZED` first, then the PATH, then the paths above.
///
/// A Zed started from the dock passes the launchd PATH on, which names no package
/// manager's prefix, so a PATH lookup alone finds nothing. `off` reveals nothing.
pub fn zed_cli() -> Option<PathBuf> {
    match std::env::var("LINE_COMMENT_ZED") {
        Ok(value) if value == "off" => return None,
        Ok(value) => return Some(PathBuf::from(value)),
        Err(_) => {}
    }
    let on_path = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&on_path)
        .map(|directory| directory.join("zed"))
        .chain(ZED_CLI_PATHS.iter().map(PathBuf::from))
        .find(|candidate| candidate.is_file())
}

pub fn with(program: &Path, path: &Path) -> Result<Child, std::io::Error> {
    Command::new(program)
        .arg("--existing")
        .arg("--")
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
}

/// Reveal through whichever CLI answers, and wait for it. The CLI exits as soon as the
/// running editor takes the path, so a caller with nothing else to do waits inline.
pub fn now(path: &Path) -> Result<(), String> {
    let Some(program) = zed_cli() else {
        return Err("no zed cli on the PATH".to_string());
    };
    let mut child = with(&program, path).map_err(|error| error.to_string())?;
    child.wait().map_err(|error| error.to_string())?;
    Ok(())
}
