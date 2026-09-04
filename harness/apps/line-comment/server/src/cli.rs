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

/// The workspace root a path belongs to: the outermost directory from the path up that
/// already holds a store, else the nearest one holding `.git`, else the current directory.
/// The search stops below `$HOME`, so a store left in the home directory claims nothing.
///
/// The server derives its root from the client's workspace folder, which is one Zed
/// project and can hold several repositories — so a store outranks `.git`, or the command
/// reads the store of one repository inside the project while the server writes the
/// project's.
///
/// The outermost store wins, not the nearest, because the workspace folder is the outer
/// one whenever a directory inside it carries a store of its own. A nested repository
/// opened on its own once — `<project>/.notes`, its own jj repo — leaves a store behind
/// that the project never writes to again, and the nearest-wins rule read that stale one
/// from every directory under it and reported no comments while the project's store held
/// them.
pub fn root_for(path: &Path) -> PathBuf {
    let current = std::env::current_dir().unwrap_or_default();
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        current.join(path)
    };
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let mut store = None;
    let mut repository = None;
    for candidate in absolute.ancestors() {
        if Some(candidate) == home.as_deref() {
            break;
        }
        if candidate.join(".tmp").join("line-comment.json").exists() {
            store = Some(candidate.to_path_buf());
        }
        if repository.is_none() && candidate.join(".git").exists() {
            repository = Some(candidate.to_path_buf());
        }
    }
    store.or(repository).unwrap_or(current)
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

/// Hand an input file over for a target named from outside a buffer, and bring it up in
/// the editor. The operator types the body and saves, exactly as after a code action.
///
/// This is the path into a Zed commit view. Zed builds those buffers from `git cat-file`
/// rather than from the project, so no language server is attached to them and no code
/// action is offered — but `editor::CopyFileLocation` still yields `<file>:<line>`, and
/// that is all the hand-over needs.
pub fn add(target: &str) -> Result<String, String> {
    let named = parse_target(target)?;
    let (file, others) = resolve(&named.file)?;
    let root = root_for(&file);
    let (mut session, _effects) = Session::new(root);
    let uri = crate::path_to_uri(&file);
    let contents = session
        .input_for(
            &uri,
            named.line,
            named.end_line,
            &note_of(&others),
            read_on(&file, named.line).as_deref(),
        )
        .ok_or_else(|| format!("{} is not a file this server serves", file.display()))?;

    let path = session.take_input_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(&path, contents).map_err(|error| error.to_string())?;
    // A file nobody brought up is still a file the operator can open, and the watch stores
    // whatever they save into it — so a missing editor is a note, not a failure.
    match crate::reveal::now(&path) {
        Ok(()) => Ok(path.display().to_string()),
        Err(reason) => Ok(format!("{} (not revealed: {reason})", path.display())),
    }
}

/// The revision the line was last changed in, as git blame reports it for the file on
/// disk — the commit a review is almost always looking at, because the view a comment is
/// written from is the newest change to that line.
///
/// `None` when git cannot say: no repository, an uncommitted line (blame answers with the
/// all-zero sha), or no git at all. A comment without a revision is the comment this
/// command wrote before revisions existed, so nothing downstream requires one.
fn read_on(file: &Path, line: usize) -> Option<String> {
    let directory = file.parent()?;
    let blamed = std::process::Command::new("git")
        .arg("-C")
        .arg(directory)
        .arg("blame")
        .arg("-L")
        .arg(format!("{line},{line}"))
        .arg("--porcelain")
        .arg("--")
        .arg(file)
        .output()
        .ok()?;
    if !blamed.status.success() {
        return None;
    }
    let first = String::from_utf8_lossy(&blamed.stdout);
    let sha = first.split_whitespace().next()?;
    if sha.chars().all(|character| character == '0') {
        return None;
    }
    Some(sha.chars().take(SHA_WIDTH).collect())
}

/// Characters of a sha a comment carries — enough to name a commit, short enough to read.
const SHA_WIDTH: usize = 12;

/// The file a target names, and the other files it also matches.
///
/// A commit view copies the path relative to the git repository, and one Zed project can
/// hold several repositories — so a path naming no file from here is looked for inside each
/// repository under the workspace root. Two worktrees of one repository hold the same path
/// and nothing in that view says which commit was on screen, so the first in path order is
/// taken and the rest are handed to the operator, who reads the quoted lines and corrects
/// the header if the guess was wrong.
fn resolve(named: &Path) -> Result<(PathBuf, Vec<PathBuf>), String> {
    let direct = absolute(named);
    if direct.is_file() {
        return Ok((direct, Vec::new()));
    }
    let root = current_root();
    let mut found: Vec<PathBuf> = repositories(&root)
        .map(|repository| repository.join(named))
        .filter(|candidate| candidate.is_file())
        .collect();
    found.sort();
    match found.split_first() {
        Some((first, others)) => Ok((first.clone(), others.to_vec())),
        None => Err(format!(
            "{} names no file under {}",
            named.display(),
            root.display()
        )),
    }
}

/// What the operator is told when the name matched more than one file.
fn note_of(others: &[PathBuf]) -> Vec<String> {
    if others.is_empty() {
        return Vec::new();
    }
    let root = current_root();
    let mut told = vec!["this line also exists in:".to_string()];
    told.extend(
        others
            .iter()
            .map(|path| format!("  {}", display_under(&root, path))),
    );
    told.push("change the path in the header above to comment on one of those instead".to_string());
    told
}

fn display_under(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

/// The git repositories directly inside a workspace root.
fn repositories(root: &Path) -> impl Iterator<Item = PathBuf> {
    std::fs::read_dir(root)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.join(".git").exists())
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
