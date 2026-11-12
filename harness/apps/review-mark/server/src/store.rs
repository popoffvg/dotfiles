use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::hunks::Hunk;

/// The ids of the reviewed hunks, keyed by the repo-relative path of the file.
/// One store per repository, at `<repo>/.tmp/review-mark.json`.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Store {
    files: BTreeMap<String, BTreeSet<String>>,
}

pub fn store_path(repo: &Path) -> PathBuf {
    repo.join(".tmp").join("review-mark.json")
}

impl Store {
    pub fn load(path: &Path) -> Store {
        fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    /// Write a temp file and rename it over the store, so a reader never sees half a file.
    /// A new `.tmp/` gets a `.gitignore` of `*`, so the store stays out of git.
    pub fn save(&self, path: &Path) -> io::Result<()> {
        let dir = path.parent().expect("store path has a parent");
        if !dir.exists() {
            fs::create_dir_all(dir)?;
            fs::write(dir.join(".gitignore"), "*\n")?;
        }
        let temp = path.with_extension("json.tmp");
        fs::write(&temp, serde_json::to_vec_pretty(self)?)?;
        fs::rename(temp, path)
    }

    pub fn is_reviewed(&self, file: &str, hunk: &Hunk) -> bool {
        self.files.get(file).is_some_and(|ids| ids.contains(&hunk.id))
    }

    /// The reviewed count and the total count of the current hunks of `file`.
    pub fn progress(&self, file: &str, hunks: &[Hunk]) -> (usize, usize) {
        let done = hunks.iter().filter(|hunk| self.is_reviewed(file, hunk)).count();
        (done, hunks.len())
    }

    pub fn toggle_hunk(&mut self, file: &str, hunk: &Hunk) {
        let ids = self.files.entry(file.to_string()).or_default();
        if !ids.remove(&hunk.id) {
            ids.insert(hunk.id.clone());
        }
    }

    /// Mark every current hunk when one is not reviewed, else unmark them all.
    pub fn toggle_file(&mut self, file: &str, hunks: &[Hunk]) {
        let (done, total) = self.progress(file, hunks);
        let ids = self.files.entry(file.to_string()).or_default();
        if done == total {
            hunks.iter().for_each(|hunk| { ids.remove(&hunk.id); });
        } else {
            ids.extend(hunks.iter().map(|hunk| hunk.id.clone()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hunks::hunks;

    #[test]
    fn toggle_file_marks_all_then_unmarks_all() {
        let found = hunks("a\nb\nc\n", "A\nb\nC\n");
        let mut store = Store::default();
        store.toggle_hunk("f", &found[0]);
        store.toggle_file("f", &found);
        assert_eq!(store.progress("f", &found), (2, 2));
        store.toggle_file("f", &found);
        assert_eq!(store.progress("f", &found), (0, 2));
    }

    #[test]
    fn save_and_load_round_trip_and_ignore_the_dir() {
        let repo = std::env::temp_dir().join(format!("review-mark-test-{}", std::process::id()));
        let path = store_path(&repo);
        let found = hunks("a\n", "b\n");
        let mut store = Store::default();
        store.toggle_hunk("f", &found[0]);
        store.save(&path).unwrap();
        assert!(Store::load(&path).is_reviewed("f", &found[0]));
        assert_eq!(fs::read_to_string(repo.join(".tmp/.gitignore")).unwrap(), "*\n");
        fs::remove_dir_all(repo).unwrap();
    }
}
