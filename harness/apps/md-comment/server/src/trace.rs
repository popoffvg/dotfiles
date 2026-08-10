//! A one-line-per-event trace, so "did the editor even start the server?" is answerable.
//!
//! The editor spawns this process with no terminal, so stderr goes nowhere a person
//! looks. The trace file is that missing terminal. It is append-only, one line per
//! event, and truncated at startup when it grows past a megabyte.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const LIMIT: u64 = 1024 * 1024;

pub struct Trace {
    file: Option<File>,
    pid: u32,
}

impl Trace {
    /// `MD_COMMENT_LOG=off` disables it; any other value is the path to write.
    pub fn open() -> Trace {
        let path = match std::env::var("MD_COMMENT_LOG") {
            Ok(value) if value == "off" => return Trace { file: None, pid: 0 },
            Ok(value) => PathBuf::from(value),
            Err(_) => std::env::temp_dir().join("md-comment-lsp.log"),
        };
        if std::fs::metadata(&path)
            .map(|m| m.len() > LIMIT)
            .unwrap_or(false)
        {
            let _ = std::fs::remove_file(&path);
        }
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .ok();
        Trace {
            file,
            pid: std::process::id(),
        }
    }

    pub fn write(&mut self, line: &str) {
        let Some(file) = self.file.as_mut() else {
            return;
        };
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or_default();
        let _ = writeln!(file, "{seconds} pid={} {line}", self.pid);
        let _ = file.flush();
    }
}
