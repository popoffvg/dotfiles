use std::path::{Path, PathBuf};
use std::process::Command;

/// A file inside a git work tree: the work tree root and the path relative to it.
#[derive(Clone)]
pub struct RepoFile {
    pub repo: PathBuf,
    pub path: String,
}

/// `None` for a file outside a work tree, and for a file git ignores: Zed shows no diff for it.
pub fn locate(file: &Path) -> Option<RepoFile> {
    let file = file.canonicalize().ok()?;
    let repo = PathBuf::from(git(file.parent()?, &["rev-parse", "--show-toplevel"])?.trim_end());
    let path = file.strip_prefix(&repo).ok()?.to_string_lossy().replace('\\', "/");
    if git(&repo, &["check-ignore", "-q", &path]).is_some() {
        return None;
    }
    Some(RepoFile { repo, path })
}

/// The text of the file at `HEAD`; empty for a file `HEAD` does not have.
pub fn head_text(file: &RepoFile) -> String {
    git(&file.repo, &["show", &format!("HEAD:{}", file.path)]).unwrap_or_default()
}

fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git").arg("-C").arg(dir).args(args).output().ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}
