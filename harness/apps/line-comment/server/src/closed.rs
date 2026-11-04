//! The log of documents the client closed, so a shell can wait for the operator to finish
//! with a file: `wait-close` blocks until the file's key shows up here.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use crate::journal::now_millis;

/// `<root>/.tmp/line-comment.closed`, one `<unix ms> <key>` line per close.
pub fn log_path(root: &Path) -> PathBuf {
    root.join(".tmp").join("line-comment.closed")
}

pub fn append(path: &Path, key: &str) -> io::Result<()> {
    let mut log = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(log, "{} {key}", now_millis())
}

/// Whether the log holds a close of `key` at or after `since` (Unix ms).
pub fn closed_since(path: &Path, key: &str, since: u128) -> bool {
    let Ok(text) = fs::read_to_string(path) else {
        return false;
    };
    text.lines().any(|line| {
        line.split_once(' ').is_some_and(|(time, closed)| {
            closed == key && time.parse::<u128>().is_ok_and(|time| time >= since)
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_close_counts_only_for_its_key_and_from_its_time() {
        let dir = std::env::temp_dir().join(format!("line-comment-closed-{}", now_millis()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("closed");
        fs::write(&path, "100 a.md\n200 .tmp/annotate/r.md\n").unwrap();

        assert!(closed_since(&path, ".tmp/annotate/r.md", 200));
        assert!(!closed_since(&path, ".tmp/annotate/r.md", 201));
        assert!(!closed_since(&path, "b.md", 0));
        append(&path, "b.md").unwrap();
        assert!(closed_since(&path, "b.md", 300));
        fs::remove_dir_all(dir).unwrap();
    }
}
