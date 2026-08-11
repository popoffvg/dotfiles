//! The comment store: one JSON file per workspace root, under `.tmp/`.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const STORE_VERSION: u32 = 1;

/// Who wrote a comment. Both authors share the `Hint` severity, because Zed filters
/// diagnostics by severity alone — the author only ever shows in the message text.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Author {
    /// Written in the editor through the input file. The default keeps stores written
    /// before the field existed loadable.
    #[default]
    Human,
    /// Written by Claude through the `comment` subcommand.
    Agent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Comment {
    /// 1-based line in the file, matching the export format.
    pub line: usize,
    pub hash: String,
    pub text: String,
    #[serde(default)]
    pub orphaned: bool,
    #[serde(default)]
    pub author: Author,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Store {
    pub version: u32,
    pub files: BTreeMap<String, Vec<Comment>>,
}

impl Default for Store {
    fn default() -> Self {
        Store {
            version: STORE_VERSION,
            files: BTreeMap::new(),
        }
    }
}

#[derive(Debug)]
pub enum LoadError {
    UnsupportedVersion(u32),
    Malformed(String),
}

impl Store {
    /// Load the store, or start empty when the file is absent.
    pub fn load(path: &Path) -> Result<Store, LoadError> {
        let raw = match fs::read_to_string(path) {
            Ok(raw) => raw,
            Err(_) => return Ok(Store::default()),
        };
        if raw.trim().is_empty() {
            return Ok(Store::default());
        }
        let store: Store =
            serde_json::from_str(&raw).map_err(|e| LoadError::Malformed(e.to_string()))?;
        if store.version != STORE_VERSION {
            return Err(LoadError::UnsupportedVersion(store.version));
        }
        Ok(store)
    }

    /// Replace the file atomically, so a crash never leaves half a store behind.
    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let temporary = path.with_extension("json.tmp");
        fs::write(&temporary, serde_json::to_string_pretty(self)?)?;
        fs::rename(&temporary, path)
    }

    pub fn comments(&self, file: &str) -> &[Comment] {
        self.files.get(file).map(|v| v.as_slice()).unwrap_or(&[])
    }

    pub fn upsert(&mut self, file: &str, comment: Comment) {
        let comments = self.files.entry(file.to_string()).or_default();
        match comments.iter_mut().find(|c| c.line == comment.line) {
            Some(existing) => *existing = comment,
            None => comments.push(comment),
        }
        comments.sort_by_key(|c| c.line);
    }

    pub fn remove(&mut self, file: &str, line: usize) -> bool {
        let Some(comments) = self.files.get_mut(file) else {
            return false;
        };
        let before = comments.len();
        comments.retain(|c| c.line != line);
        let removed = comments.len() != before;
        if comments.is_empty() {
            self.files.remove(file);
        }
        removed
    }

    pub fn total(&self) -> usize {
        self.files.values().map(|c| c.len()).sum()
    }

    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    pub fn clear(&mut self) {
        self.files.clear();
    }
}

/// Create `<root>/.tmp/` and keep it out of git when the root is a repository.
pub fn ensure_tmp_dir(root: &Path) -> io::Result<PathBuf> {
    let tmp = root.join(".tmp");
    fs::create_dir_all(&tmp)?;
    if root.join(".git").exists() {
        let gitignore = root.join(".gitignore");
        let current = fs::read_to_string(&gitignore).unwrap_or_default();
        if !current.lines().any(|l| l.trim() == ".tmp/") {
            let separator = if current.is_empty() || current.ends_with('\n') {
                ""
            } else {
                "\n"
            };
            fs::write(&gitignore, format!("{current}{separator}.tmp/\n"))?;
        }
    }
    Ok(tmp)
}
