//! The store journal: every change to the store, appended as one JSON line, so a store that
//! is lost or overwritten can be rebuilt with `line-comment-lsp restore`.
//!
//! A line is written before the change reaches the store file, and before an input file is
//! deleted — the journal holds the comment even when the process ends before the store is
//! saved. Lines are never rewritten or truncated.

use std::collections::BTreeMap;
use std::fs::OpenOptions;
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::store::{Comment, Store};

/// Journal file name under `<root>/.tmp/`.
pub const JOURNAL_FILE_NAME: &str = "line-comment.journal.jsonl";

/// One change to the store.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum StoreEvent {
    /// A comment was written or replaced. `source` names the writer: the input file path,
    /// or the subcommand.
    Put {
        file: String,
        comment: Comment,
        source: String,
    },
    /// The comment starting on `line` was removed.
    Drop { file: String, line: usize },
    /// Every comment was removed.
    Clear,
    /// Edits moved the anchors of one file; `comments` is its whole list after the move.
    Anchor {
        file: String,
        comments: Vec<Comment>,
    },
    /// The whole store as read from disk: the baseline of a journal that starts after the
    /// store existed, a write by another process, or a restore.
    Snapshot {
        files: BTreeMap<String, Vec<Comment>>,
        reason: String,
    },
}

/// One journal line: when, which process, and the change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JournalEntry {
    /// Unix time in milliseconds.
    pub at: u128,
    pub pid: u32,
    #[serde(flatten)]
    pub event: StoreEvent,
}

/// Append one change. A failed write is returned, never retried: the journal must not
/// stop the store change it describes.
pub fn append_store_event(path: &Path, event: StoreEvent) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let entry = JournalEntry {
        at: now_millis(),
        pid: std::process::id(),
        event,
    };
    let mut line = serde_json::to_string(&entry)?;
    line.push('\n');
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    // One write per line, so lines from two processes appending at once do not interleave.
    file.write_all(line.as_bytes())
}

/// Every entry in the journal, in the order written. A line that does not parse is skipped:
/// a crash can leave the last line half written.
pub fn read_journal(path: &Path) -> io::Result<Vec<JournalEntry>> {
    let file = std::fs::File::open(path)?;
    Ok(BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect())
}

/// The store as it stood after the last entry written at or before `until` (Unix ms);
/// `None` replays every entry.
pub fn replay_journal(entries: &[JournalEntry], until: Option<u128>) -> Store {
    let mut store = Store::default();
    for entry in entries
        .iter()
        .filter(|entry| until.is_none_or(|until| entry.at <= until))
    {
        match &entry.event {
            StoreEvent::Put { file, comment, .. } => store.upsert(file, comment.clone()),
            StoreEvent::Drop { file, line } => {
                store.remove(file, *line);
            }
            StoreEvent::Clear => store.clear(),
            StoreEvent::Anchor { file, comments } => {
                if comments.is_empty() {
                    store.files.remove(file);
                } else {
                    store.files.insert(file.clone(), comments.clone());
                }
            }
            StoreEvent::Snapshot { files, .. } => store.files = files.clone(),
        }
    }
    store
}

/// One entry as a line to read: time in Unix ms, pid, event, target, and the text.
pub fn describe_entry(entry: &JournalEntry) -> String {
    let head = format!("{} pid={}", entry.at, entry.pid);
    match &entry.event {
        StoreEvent::Put {
            file,
            comment,
            source,
        } => format!(
            "{head} put {file}:{} from {source}: {}",
            comment.line,
            comment.text.replace('\n', "⏎")
        ),
        StoreEvent::Drop { file, line } => format!("{head} drop {file}:{line}"),
        StoreEvent::Clear => format!("{head} clear"),
        StoreEvent::Anchor { file, comments } => {
            format!("{head} anchor {file} ({} comment(s))", comments.len())
        }
        StoreEvent::Snapshot { files, reason } => format!(
            "{head} snapshot {reason} ({} comment(s))",
            files.values().map(Vec::len).sum::<usize>()
        ),
    }
}

/// `<root>/.tmp/line-comment.journal.jsonl`.
pub fn journal_path(root: &Path) -> PathBuf {
    root.join(".tmp").join(JOURNAL_FILE_NAME)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_millis())
}
