//! The subcommands Claude uses to write comments, with no editor and no LSP session.
//!
//! Each one loads the store, changes it, and saves. A running server picks the change up
//! through the watch it holds on the store file, so the comment reaches the editor within
//! one file-watch tick of the command returning.

use std::path::{Path, PathBuf};

use crate::span;
use crate::store::Author;
use crate::{export, Session};

/// `<file>:<line>` or `<file>:<line>-<end>` — the lines named the way the input file
/// header names them.
pub struct Target {
    pub file: PathBuf,
    pub line: usize,
    pub end_line: usize,
}

pub fn parse_target(argument: &str) -> Result<Target, String> {
    let (file, lines_named) = argument
        .rsplit_once(':')
        .ok_or_else(|| format!("expected <file>:<line>, got `{argument}`"))?;
    let (line, end_line) = span::parse(lines_named).ok_or_else(|| {
        format!("`{lines_named}` names no lines in `{argument}` — expected 12 or 12-18")
    })?;
    Ok(Target {
        file: PathBuf::from(file),
        line,
        end_line,
    })
}

/// The workspace root the current directory belongs to — the root of a command naming no
/// file.
pub fn current_root() -> PathBuf {
    let current = std::env::current_dir().unwrap_or_default();
    root_for(&current)
}

/// The workspace root a path belongs to: the nearest directory from the path up that
/// already holds a store, else the nearest one holding `.git`, else the current directory.
/// The search stops below `$HOME`, so a store left in the home directory claims nothing.
///
/// The server derives its root from the client's workspace folder, which is one Zed
/// project and can hold several repositories — so an existing store outranks `.git`, or
/// the command reads the store of one repository inside the project while the server
/// writes the project's.
pub fn root_for(path: &Path) -> PathBuf {
    let current = std::env::current_dir().unwrap_or_default();
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        current.join(path)
    };
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let mut repository = None;
    for candidate in absolute.ancestors() {
        if Some(candidate) == home.as_deref() {
            break;
        }
        if candidate.join(".tmp").join("line-comment.json").exists() {
            return candidate.to_path_buf();
        }
        if repository.is_none() && candidate.join(".git").exists() {
            repository = Some(candidate.to_path_buf());
        }
    }
    repository.unwrap_or(current)
}

/// Attach a comment to a line or a span of lines, replacing whatever the first line of it
/// already carried.
pub fn comment(target: &str, text: &str) -> Result<String, String> {
    let target = parse_target(target)?;
    let root = root_for(&target.file);
    let (mut session, _effects) = Session::new(root);
    let uri = crate::path_to_uri(&absolute(&target.file));
    let key = session
        .key(&uri)
        .ok_or_else(|| format!("{} is not a file this server serves", target.file.display()))?;

    session.upsert_comment(
        &key,
        target.line,
        target.end_line,
        text.to_string(),
        Author::Agent,
    );
    session.persist().map_err(|error| error.to_string())?;
    Ok(format!(
        "{key}:{}",
        span::label(target.line, target.end_line)
    ))
}

/// Drop the comment on each line named. Reports every target, whether it held one or not.
///
/// One session for the whole batch, so the store is written once — a running server reads
/// it back on its watch, and one write is one reload.
pub fn drop_comments(targets: &[String]) -> Result<String, String> {
    let first = targets
        .first()
        .ok_or("expected at least one <file>:<line>")?;
    let root = root_for(&parse_target(first)?.file);
    let (mut session, _effects) = Session::new(root);

    let mut lines = Vec::new();
    for target in targets {
        let target = parse_target(target)?;
        let uri = crate::path_to_uri(&absolute(&target.file));
        let key = session
            .key(&uri)
            .ok_or_else(|| format!("{} is not a file this server serves", target.file.display()))?;
        let dropped = session.store_mut().remove(&key, target.line);
        lines.push(format!(
            "{} {key}:{}",
            if dropped { "dropped" } else { "no comment on" },
            target.line
        ));
    }
    session.persist().map_err(|error| error.to_string())?;
    Ok(lines.join("\n"))
}

/// Drop every comment in the workspace — `reset comments`, from a shell.
pub fn drop_all() -> Result<String, String> {
    let root = current_root();
    let (mut session, _effects) = Session::new(root);
    let total = session.store().total();
    session.store_mut().clear();
    session.persist().map_err(|error| error.to_string())?;
    Ok(format!("dropped {total} comment(s)"))
}

/// The store the commands read and write, for a caller that has to open it itself.
pub fn store_path() -> Result<String, String> {
    let (session, _effects) = Session::new(current_root());
    Ok(session.store_path().display().to_string())
}

/// Every comment in the store, in the export format the `/line-comment:act` command reads.
pub fn list() -> Result<String, String> {
    let root = current_root();
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
