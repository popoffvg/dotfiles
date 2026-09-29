//! A `zed-diff.sh` work dir: mirror trees `<work_dir>/<tree>/<file>` beside a marker file
//! naming the repo they mirror. A diff file is stored as the repo file it mirrors.

use std::path::{Path, PathBuf};

/// Written by `zed-diff.sh` into the work dir; holds the absolute repo root.
pub const REPO_MARKER: &str = ".line-comment-repo";

/// The mirror tree `zed-diff.sh` builds from the live working tree. Every other tree is
/// named by the short sha it was read from.
pub const LIVE_TREE: &str = "working-tree";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffView {
    work_dir: PathBuf,
    repo: PathBuf,
}

/// The repo file one diff-tree file mirrors.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffFile {
    pub repo_path: PathBuf,
    /// The short sha of a snapshot tree; `None` for the live tree.
    pub revision: Option<String>,
}

impl DiffView {
    /// The work dir that holds `path`, found by the marker in `path` or an ancestor.
    pub fn find(path: &Path) -> Option<DiffView> {
        path.ancestors().find_map(|dir| {
            let text = std::fs::read_to_string(dir.join(REPO_MARKER)).ok()?;
            let repo = PathBuf::from(text.trim());
            repo.is_absolute().then(|| DiffView {
                work_dir: dir.to_path_buf(),
                repo,
            })
        })
    }

    pub fn repo(&self) -> &Path {
        &self.repo
    }

    /// `<work_dir>/<tree>/<rel>` as `<repo>/<rel>`; `None` for a path outside every tree.
    pub fn locate(&self, path: &Path) -> Option<DiffFile> {
        let mut parts = path.strip_prefix(&self.work_dir).ok()?.components();
        let tree = parts.next()?.as_os_str().to_str()?.to_string();
        let relative = parts.as_path();
        if relative.as_os_str().is_empty() {
            return None;
        }
        Some(DiffFile {
            repo_path: self.repo.join(relative),
            revision: (tree != LIVE_TREE).then_some(tree),
        })
    }
}
