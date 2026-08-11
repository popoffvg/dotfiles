//! The subcommands Claude uses to write comments, with no editor and no LSP session.
//!
//! Each one loads the store, changes it, and saves. A running server picks the change up
//! through the watch it holds on the store file, so the comment reaches the editor within
//! one file-watch tick of the command returning.

use std::path::{Path, PathBuf};

use crate::store::Author;
use crate::{export, Session};

/// `<file>:<line>` — the same shape the export and the input file header use.
pub struct Target {
    pub file: PathBuf,
    pub line: usize,
}

pub fn parse_target(argument: &str) -> Result<Target, String> {
    let (file, line) = argument
        .rsplit_once(':')
        .ok_or_else(|| format!("expected <file>:<line>, got `{argument}`"))?;
    let line: usize = line
        .parse()
        .map_err(|_| format!("`{line}` is not a line number in `{argument}`"))?;
    if line == 0 {
        return Err("lines are numbered from 1".to_string());
    }
    Ok(Target {
        file: PathBuf::from(file),
        line,
    })
}

/// The workspace root a path belongs to: its nearest ancestor holding `.git`, else the
/// current directory. The server derives the same root from the client's workspace
/// folder, and the two have to agree or they read different stores.
pub fn root_for(path: &Path) -> PathBuf {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_default().join(path)
    };
    let mut cursor = absolute.as_path();
    while let Some(parent) = cursor.parent() {
        if parent.join(".git").exists() {
            return parent.to_path_buf();
        }
        cursor = parent;
    }
    std::env::current_dir().unwrap_or_default()
}

/// Attach a comment to a line, replacing whatever that line already carried.
pub fn comment(target: &str, text: &str) -> Result<String, String> {
    let target = parse_target(target)?;
    let root = root_for(&target.file);
    let (mut session, _effects) = Session::new(root);
    let uri = crate::path_to_uri(&absolute(&target.file));
    let key = session
        .key(&uri)
        .ok_or_else(|| format!("{} is not a file this server serves", target.file.display()))?;

    session.upsert_comment(&key, target.line, text.to_string(), Author::Agent);
    session.persist().map_err(|error| error.to_string())?;
    Ok(format!("{key}:{}", target.line))
}

/// Drop the comment on a line. Reports whether there was one.
pub fn drop_comment(target: &str) -> Result<String, String> {
    let target = parse_target(target)?;
    let root = root_for(&target.file);
    let (mut session, _effects) = Session::new(root);
    let uri = crate::path_to_uri(&absolute(&target.file));
    let key = session
        .key(&uri)
        .ok_or_else(|| format!("{} is not a file this server serves", target.file.display()))?;

    if !session.store_mut().remove(&key, target.line) {
        return Ok(format!("no comment on {key}:{}", target.line));
    }
    session.persist().map_err(|error| error.to_string())?;
    Ok(format!("dropped {key}:{}", target.line))
}

/// Every comment in the store, in the export format the `/md-comment` command reads.
pub fn list() -> Result<String, String> {
    let root = root_for(Path::new("."));
    let (session, _effects) = Session::new(root);
    Ok(export::render(session.store()))
}

fn absolute(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_default().join(path)
    }
}
