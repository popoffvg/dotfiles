//! GitHub PR review threads shown on the lines they target, read-only.

pub mod github;
pub mod list;
pub mod placement;
pub mod review;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use placement::{locate, Span};
use review::{Review, Thread};

pub const COMMAND_SYNC: &str = "pr-comments.sync";
pub const COMMAND_LIST: &str = "pr-comments.list";
pub const COMMAND_OPEN: &str = "pr-comments.open";

pub struct Session {
    repo: PathBuf,
    review: Option<Review>,
    /// Repository path → the file in the PR head commit, None when the commit is not local.
    heads: HashMap<String, Option<String>>,
    /// Repository path → the text of the open buffer.
    buffers: HashMap<String, String>,
}

impl Session {
    /// Starts from the last sync that the store holds, so a restart needs no new sync.
    pub fn new(repo: PathBuf) -> Session {
        let mut session =
            Session { repo, review: None, heads: HashMap::new(), buffers: HashMap::new() };
        session.reload();
        session
    }

    /// Read the store again: a sync from a shell or a Zed task writes it.
    pub fn reload(&mut self) {
        self.review = std::fs::read_to_string(self.store_path())
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok());
        self.heads.clear();
    }

    pub fn store_path(&self) -> PathBuf {
        self.repo.join(".tmp").join("pr-comments.json")
    }

    pub fn repo(&self) -> &Path {
        &self.repo
    }

    pub fn list_path(&self) -> PathBuf {
        self.repo.join(".tmp").join("pr-comments.md")
    }

    /// Read the threads from GitHub, save them, and rewrite the list page, so an open
    /// preview of it shows the new threads.
    pub fn sync(&mut self, progress: &mut impl FnMut(u32, &str)) -> Result<String, github::FetchError> {
        let review = github::fetch(&self.repo, progress)?;
        progress(66, "saving the threads and the list page");
        let tmp = self.repo.join(".tmp");
        std::fs::create_dir_all(&tmp).map_err(|error| write_error(&tmp, error))?;
        let ignore = tmp.join(".gitignore");
        std::fs::write(&ignore, "*\n").map_err(|error| write_error(&ignore, error))?;
        let store = self.store_path();
        let text = serde_json::to_string_pretty(&review).unwrap_or_default();
        std::fs::write(&store, text).map_err(|error| write_error(&store, error))?;
        let open = review.threads.iter().filter(|thread| thread.is_inline()).count();
        let summary = format!(
            "synced {} threads ({open} open) from PR #{}",
            review.threads.len(),
            review.number
        );
        self.review = Some(review);
        self.heads.clear();
        self.write_list()?;
        Ok(summary)
    }

    pub fn write_list(&mut self) -> Result<PathBuf, String> {
        let Some(review) = self.review.clone() else {
            return Err("pr-comments: no threads yet, run `sync PR comments` first".to_string());
        };
        let page = list::render(&review, &self.repo.clone(), |path| {
            let current = self
                .buffers
                .get(path)
                .cloned()
                .or_else(|| std::fs::read_to_string(self.repo.join(path)).ok());
            (self.head(&review.head_oid, path), current)
        });
        let path = self.list_path();
        std::fs::write(&path, page).map_err(|error| write_error(&path, error))?;
        Ok(path)
    }

    /// Track the text of an open buffer; None when the buffer closes.
    pub fn set_buffer(&mut self, file: &Path, text: Option<String>) {
        let Some(path) = self.relative(file) else {
            return;
        };
        match text {
            Some(text) => self.buffers.insert(path, text),
            None => self.buffers.remove(&path),
        };
    }

    pub fn open_files(&self) -> Vec<PathBuf> {
        self.buffers.keys().map(|path| self.repo.join(path)).collect()
    }

    /// One lens per inline thread, on the line under its last line: Zed draws a lens above
    /// its line. On the last line of the file the lens stays above that line.
    pub fn code_lenses(&mut self, file: &Path) -> Vec<Value> {
        let Some((text, spans)) = self.spans(file) else {
            return Vec::new();
        };
        let last = text.lines().count().saturating_sub(1) as u32;
        spans
            .iter()
            .map(|(span, thread)| {
                let line = (span.end + 1).min(last);
                json!({
                    "range": { "start": { "line": line, "character": 0 },
                               "end": { "line": line, "character": 0 } },
                    "command": { "title": lens_title(thread, span),
                                 "command": COMMAND_OPEN,
                                 "arguments": [thread.url()] }
                })
            })
            .collect()
    }

    /// One Hint diagnostic per inline thread, over the lines it covers.
    pub fn diagnostics(&mut self, file: &Path) -> Vec<Value> {
        let Some((text, spans)) = self.spans(file) else {
            return Vec::new();
        };
        let lines: Vec<&str> = text.lines().collect();
        spans
            .iter()
            .map(|(span, thread)| {
                let end_character: usize = lines
                    .get(span.end as usize)
                    .map_or(0, |line| line.encode_utf16().count());
                let message = thread
                    .comments
                    .iter()
                    .map(|comment| format!("{}: {}", comment.author, comment.body.trim()))
                    .collect::<Vec<_>>()
                    .join("\n\n");
                json!({
                    "range": { "start": { "line": span.start, "character": 0 },
                               "end": { "line": span.end, "character": end_character } },
                    "severity": 4,
                    "source": "pr-comments",
                    "message": message
                })
            })
            .collect()
    }

    fn spans(&mut self, file: &Path) -> Option<(String, Vec<(Span, Thread)>)> {
        let path = self.relative(file)?;
        let text = self.buffers.get(&path)?.clone();
        let review = self.review.clone()?;
        let head = self.head(&review.head_oid, &path);
        let spans = review
            .threads
            .into_iter()
            .filter(|thread| thread.path == path)
            .filter_map(|thread| Some((locate(&thread, head.as_deref(), &text)?, thread)))
            .collect();
        Some((text, spans))
    }

    fn head(&mut self, commit: &str, path: &str) -> Option<String> {
        self.heads
            .entry(path.to_string())
            .or_insert_with(|| github::file_at(&self.repo, commit, path))
            .clone()
    }

    fn relative(&self, file: &Path) -> Option<String> {
        Some(file.strip_prefix(&self.repo).ok()?.to_string_lossy().into_owned())
    }
}

fn lens_title(thread: &Thread, span: &Span) -> String {
    let first = thread.comments.first();
    let author = first.map_or("", |comment| comment.author.as_str());
    let line = first.and_then(|comment| comment.body.lines().next()).unwrap_or_default();
    let mut title = format!("🐙 {author}: {line}");
    if thread.comments.len() > 1 {
        title.push_str(&format!(" (+{})", thread.comments.len() - 1));
    }
    if span.moved {
        title.push_str(" · moved");
    }
    title
}

fn write_error(path: &Path, error: std::io::Error) -> String {
    format!("pr-comments: cannot write {} ({error})", path.display())
}

pub fn uri_to_path(uri: &str) -> Option<PathBuf> {
    let rest = uri.strip_prefix("file://")?;
    let bytes = rest.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let hex = bytes.get(index + 1..index + 3).and_then(|hex| std::str::from_utf8(hex).ok());
        if bytes[index] == b'%' {
            if let Some(byte) = hex.and_then(|hex| u8::from_str_radix(hex, 16).ok()) {
                decoded.push(byte);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    Some(PathBuf::from(String::from_utf8(decoded).ok()?))
}

pub fn path_to_uri(path: &Path) -> String {
    format!("file://{}", path.to_string_lossy().replace('%', "%25").replace(' ', "%20"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use review::Comment;

    fn session(repo: &Path) -> Session {
        let mut session = Session::new(repo.to_path_buf());
        session.review = Some(Review {
            number: 7,
            title: "Retry".into(),
            url: "https://github.com/o/r/pull/7".into(),
            head_oid: "not-a-local-commit".into(),
            threads: vec![Thread {
                path: "a.go".into(),
                start_line: Some(1),
                line: Some(2),
                side: "RIGHT".into(),
                resolved: false,
                outdated: false,
                comments: vec![
                    Comment {
                        author: "alice".into(),
                        body: "Check the status.\nThen retry.".into(),
                        url: "https://github.com/o/r/pull/7#discussion_r1".into(),
                        created_at: "2026-11-01T10:00:00Z".into(),
                        diff_hunk: String::new(),
                    },
                    Comment {
                        author: "bob".into(),
                        body: "Agreed.".into(),
                        url: "https://github.com/o/r/pull/7#discussion_r2".into(),
                        created_at: "2026-11-02T10:00:00Z".into(),
                        diff_hunk: String::new(),
                    },
                ],
            }],
        });
        session
    }

    #[test]
    fn an_open_buffer_gets_a_lens_under_the_thread_and_a_hint_over_it() {
        let repo = Path::new("/no/such/repo");
        let mut session = session(repo);
        let file = repo.join("a.go");
        session.set_buffer(&file, Some("one\ntwo\nthree\n".into()));

        let lenses = session.code_lenses(&file);
        assert_eq!(lenses.len(), 1);
        assert_eq!(lenses[0]["range"]["start"]["line"], 2);
        assert_eq!(lenses[0]["command"]["title"], "🐙 alice: Check the status. (+1)");
        assert_eq!(lenses[0]["command"]["arguments"][0], "https://github.com/o/r/pull/7#discussion_r1");

        let diagnostics = session.diagnostics(&file);
        assert_eq!(diagnostics[0]["range"]["start"]["line"], 0);
        assert_eq!(diagnostics[0]["range"]["end"]["line"], 1);
        assert_eq!(diagnostics[0]["range"]["end"]["character"], 3);

        session.set_buffer(&file, None);
        assert!(session.code_lenses(&file).is_empty());
    }

    #[test]
    fn a_file_uri_round_trips_through_a_path_with_a_space() {
        let path = Path::new("/repo/my dir/a.go");
        assert_eq!(uri_to_path(&path_to_uri(path)).unwrap(), path);
    }
}
