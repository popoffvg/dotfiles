//! Comment session: every behaviour of the server, with no transport and no event loop.

pub mod anchor;
pub mod cli;
pub mod export;
pub mod input;
pub mod store;
pub mod trace;
pub mod wire;

use std::collections::{HashMap, HashSet};
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::input::Target;
use crate::store::{Author, Comment, LoadError, Store};
use crate::wire::{
    Change, CodeAction, Command, Diagnostic, InlayHint, MarkupContent, Position,
    PublishDiagnostics, Range, CODE_ACTION_KIND, COMMAND_ADD, COMMAND_COPY, COMMAND_DELETE,
    COMMAND_LIST, COMMAND_RESET, DIAGNOSTIC_SOURCE, SEVERITY_HINT,
};

/// Characters of comment text an inlay hint shows before it truncates.
pub const HINT_WIDTH: usize = 40;

const HINT_MARK: &str = "💬 ";
const HINT_MARK_ORPHANED: &str = "💬? ";

/// Claude's comments carry this in front of their text. Human and agent comments share
/// one severity, so the message is the only place the author can show.
const AGENT_MARK: &str = "🤖 ";

/// Work for the caller to perform after a request is answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Effect {
    PersistStore,
    WriteExport,
    RefreshInlayHints,
    ShowMessage {
        error: bool,
        text: String,
    },
    AskResetConfirmation {
        prompt: String,
    },
    /// Create the input file with this content and put it in front of the operator.
    OpenInput {
        contents: String,
    },
    /// Ask the client to watch the input file and the store, so a write by the operator
    /// or by the `comment` subcommand is noticed without an open buffer.
    WatchFiles,
    /// Push one Hint diagnostic per comment, so the comments show inline and in the
    /// editor's diagnostics list even when inlay hints are switched off.
    PublishDiagnostics,
    /// Write the export, then put it in front of the operator.
    OpenList {
        contents: String,
    },
}

pub struct Session {
    root: PathBuf,
    store: Store,
    documents: HashMap<String, String>,
    /// Files we last published diagnostics for, so they can be cleared when emptied.
    published: HashSet<String>,
}

impl Session {
    /// Load the store for `root`, falling back to an empty store when it cannot be read.
    pub fn new(root: PathBuf) -> (Session, Vec<Effect>) {
        let path = root.join(".tmp").join("md-comment.json");
        let (store, effects) = match Store::load(&path) {
            Ok(store) => (store, Vec::new()),
            Err(LoadError::UnsupportedVersion(version)) => (
                Store::default(),
                vec![Effect::ShowMessage {
                    error: true,
                    text: format!(
                        "md-comment: store version {version} is not supported, starting empty and leaving {} untouched",
                        path.display()
                    ),
                }],
            ),
            Err(LoadError::Malformed(reason)) => (
                Store::default(),
                vec![Effect::ShowMessage {
                    error: true,
                    text: format!("md-comment: cannot read the store ({reason}), starting empty"),
                }],
            ),
        };
        let mut session = Session {
            root,
            store,
            documents: HashMap::new(),
            published: HashSet::new(),
        };
        let mut effects = effects;
        effects.push(Effect::WatchFiles);
        // A save the previous run never saw — the watch only reports changes while the
        // server lives, so anything left in the input file is picked up here instead.
        effects.extend(session.drain_input());
        effects.push(Effect::PublishDiagnostics);
        (session, effects)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn store(&self) -> &Store {
        &self.store
    }

    pub fn store_mut(&mut self) -> &mut Store {
        &mut self.store
    }

    pub fn store_path(&self) -> PathBuf {
        self.root.join(".tmp").join("md-comment.json")
    }

    pub fn export_path(&self) -> PathBuf {
        self.root.join(".tmp").join("md-comment.md")
    }

    /// A rendered view of the export, regenerated on every `list comments`. The export
    /// itself stays untouched, because that is the file the Claude command reads.
    pub fn list_path(&self) -> PathBuf {
        self.root.join(".tmp").join("md-comment-list.md")
    }

    pub fn input_path(&self) -> PathBuf {
        self.root.join(".tmp").join(input::FILE_NAME)
    }

    /// Read the input file, store whatever was typed, and empty it.
    ///
    /// Runs on every save the watch reports and once at startup. An empty body means the
    /// operator saved without writing, which cancels the pending comment.
    pub fn drain_input(&mut self) -> Vec<Effect> {
        let path = self.input_path();
        let Ok(text) = std::fs::read_to_string(&path) else {
            return Vec::new();
        };
        let Some((target, body)) = input::parse(&text) else {
            return Vec::new();
        };
        let _ = std::fs::write(&path, "");
        if body.is_empty() {
            return Vec::new();
        }

        self.upsert_comment(&target.file, target.line, body, Author::Human);
        vec![
            Effect::PersistStore,
            Effect::RefreshInlayHints,
            Effect::PublishDiagnostics,
        ]
    }

    /// Take up the store as it stands on disk, when something outside this server wrote
    /// it — the `comment` subcommand, or another editor window on the same root.
    ///
    /// The server's own `persist` triggers the same watch. Reloading what was just
    /// written costs one read and changes nothing, which is why no write marker is kept.
    pub fn reload_store(&mut self) -> Vec<Effect> {
        let Ok(store) = Store::load(&self.store_path()) else {
            return Vec::new();
        };
        if store.files == self.store.files {
            return Vec::new();
        }
        self.store = store;
        vec![Effect::RefreshInlayHints, Effect::PublishDiagnostics]
    }

    /// Store one comment against a line, keeping the anchor hash of that line as it reads
    /// now. Used by the `comment` subcommand and by the input file alike.
    pub fn upsert_comment(&mut self, key: &str, line: usize, text: String, author: Author) {
        let document = self.text_of(key);
        let lines = anchor::lines(&document);
        let line = line.max(1);
        self.store.upsert(
            key,
            Comment {
                line,
                hash: anchor::line_hash(lines.get(line - 1).copied().unwrap_or("")),
                text,
                orphaned: false,
                author,
            },
        );
    }

    /// The text of a target, from its open buffer when there is one, else from disk.
    fn text_of(&self, key: &str) -> String {
        self.current_text(key).unwrap_or_default()
    }

    pub fn export_text(&self) -> String {
        export::render(&self.store)
    }

    pub fn persist(&self) -> io::Result<()> {
        store::ensure_tmp_dir(&self.root)?;
        self.store.save(&self.store_path())
    }

    pub fn write_export(&self) -> io::Result<PathBuf> {
        store::ensure_tmp_dir(&self.root)?;
        let path = self.export_path();
        std::fs::write(&path, self.export_text())?;
        Ok(path)
    }

    /// One Hint diagnostic per comment, per file, plus an empty list for any file that
    /// had comments last time and has none now — an editor keeps showing what it was
    /// last told, so clearing has to be explicit.
    pub fn diagnostics(&mut self) -> Vec<PublishDiagnostics> {
        let mut payloads = Vec::new();
        let mut current = HashSet::new();

        for (key, comments) in &self.store.files {
            let uri = path_to_uri(&self.path_of(key));
            let text = self.current_text(key).unwrap_or_default();
            let lines = anchor::lines(&text);
            let diagnostics = comments
                .iter()
                .map(|comment| {
                    let line = (comment.line - 1) as u32;
                    let end = anchor::utf16_len(lines.get(comment.line - 1).copied().unwrap_or(""));
                    Diagnostic {
                        range: Range {
                            start: Position { line, character: 0 },
                            end: Position {
                                line,
                                character: end,
                            },
                        },
                        severity: SEVERITY_HINT,
                        source: DIAGNOSTIC_SOURCE,
                        message: message_of(comment),
                    }
                })
                .collect();
            current.insert(uri.clone());
            payloads.push(PublishDiagnostics { uri, diagnostics });
        }

        for stale in self.published.difference(&current) {
            payloads.push(PublishDiagnostics {
                uri: stale.clone(),
                diagnostics: Vec::new(),
            });
        }
        self.published = current;
        payloads
    }

    /// The path a store key names.
    fn path_of(&self, key: &str) -> PathBuf {
        let path = PathBuf::from(key);
        if path.is_absolute() {
            path
        } else {
            self.root.join(path)
        }
    }

    /// The text of a file, from its open buffer when there is one, else from disk.
    fn current_text(&self, key: &str) -> Option<String> {
        let open = self
            .documents
            .iter()
            .find(|(uri, _)| self.key(uri).as_deref() == Some(key))
            .map(|(_, text)| text.clone());
        match open {
            Some(text) => Some(text),
            None => std::fs::read_to_string(self.path_of(key)).ok(),
        }
    }

    /// Re-anchor every comment against the file as it stands now.
    ///
    /// A file edited while closed moves its lines with nobody watching, so the stored
    /// line is only trustworthy right after this runs. A file that cannot be read
    /// keeps its anchors untouched — a missing file is not evidence the text is gone.
    pub fn reconcile_all(&mut self) -> bool {
        let keys: Vec<String> = self.store.files.keys().cloned().collect();
        let mut changed = false;
        for key in keys {
            let Some(text) = self.current_text(&key) else {
                continue;
            };
            let before = self.store.comments(&key).to_vec();
            if let Some(comments) = self.store.files.get_mut(&key) {
                anchor::reconcile(&text, comments);
                comments.sort_by_key(|c| c.line);
            }
            changed |= self.store.comments(&key) != before.as_slice();
        }
        changed
    }

    /// The store key for a document this server serves, or `None` when it does not.
    ///
    /// Every file type is served — a comment is a line annotation, and nothing about it
    /// depends on the language. Only the server's own scratch files under `.tmp/` are
    /// refused, so a comment never lands on the input file or the export.
    pub fn key(&self, uri: &str) -> Option<String> {
        let path = uri_to_path(uri)?;
        let relative = path.strip_prefix(&self.root).ok();
        if let Some(relative) = relative {
            if relative.starts_with(".tmp") {
                return None;
            }
            return Some(relative.to_string_lossy().replace('\\', "/"));
        }
        Some(path.to_string_lossy().replace('\\', "/"))
    }

    pub fn did_open(&mut self, uri: &str, text: String) -> Vec<Effect> {
        let Some(key) = self.key(uri) else {
            return Vec::new();
        };
        self.documents.insert(uri.to_string(), text);
        let text = self.documents.get(uri).cloned().unwrap_or_default();
        let before = self.store.comments(&key).to_vec();
        if let Some(comments) = self.store.files.get_mut(&key) {
            anchor::reconcile(&text, comments);
            comments.sort_by_key(|c| c.line);
        }
        if self.store.comments(&key) == before.as_slice() {
            vec![Effect::PublishDiagnostics]
        } else {
            vec![
                Effect::PersistStore,
                Effect::RefreshInlayHints,
                Effect::PublishDiagnostics,
            ]
        }
    }

    pub fn did_change(&mut self, uri: &str, changes: &[Change]) -> Vec<Effect> {
        let Some(key) = self.key(uri) else {
            return Vec::new();
        };
        let before = self.store.comments(&key).to_vec();
        let mut text = self.documents.get(uri).cloned().unwrap_or_default();

        for change in changes {
            match change.range {
                Some((start_line, start_character, end_line, end_character)) => {
                    let touched = match self.store.files.get_mut(&key) {
                        Some(comments) => {
                            anchor::shift_for_change(comments, start_line, end_line, &change.text)
                        }
                        None => Vec::new(),
                    };
                    anchor::apply_change(
                        &mut text,
                        Some((start_line, start_character, end_line, end_character)),
                        &change.text,
                    );
                    if let Some(comments) = self.store.files.get_mut(&key) {
                        anchor::rehash(&text, comments, &touched);
                        comments.sort_by_key(|c| c.line);
                    }
                }
                None => {
                    anchor::apply_change(&mut text, None, &change.text);
                    if let Some(comments) = self.store.files.get_mut(&key) {
                        anchor::reconcile(&text, comments);
                        comments.sort_by_key(|c| c.line);
                    }
                }
            }
        }

        self.documents.insert(uri.to_string(), text);
        if self.store.comments(&key) == before.as_slice() {
            Vec::new()
        } else {
            vec![Effect::PersistStore, Effect::PublishDiagnostics]
        }
    }

    pub fn did_save(&mut self, uri: &str) -> Vec<Effect> {
        // The input file lives under `.tmp/`, so `key` refuses it — but its save is the
        // whole point. The watch reports the same save; draining twice is harmless
        // because the first drain empties the file.
        if uri_to_path(uri).as_deref() == Some(self.input_path().as_path()) {
            return self.drain_input();
        }
        match self.key(uri) {
            Some(_) => vec![Effect::PersistStore],
            None => Vec::new(),
        }
    }

    pub fn did_close(&mut self, uri: &str) {
        self.documents.remove(uri);
    }

    /// The input file, aimed at one line. The operator types the body and saves.
    pub fn input_for(&self, uri: &str, line: usize) -> Option<String> {
        let key = self.key(uri)?;
        Some(input::render(&Target {
            file: key,
            line: line.max(1),
        }))
    }

    pub fn inlay_hints(&self, uri: &str, range: Range) -> Vec<InlayHint> {
        let Some(key) = self.key(uri) else {
            return Vec::new();
        };
        let document = self.documents.get(uri).cloned().unwrap_or_default();
        let lines = anchor::lines(&document);
        self.store
            .comments(&key)
            .iter()
            .filter(|comment| in_range(comment.line, range))
            .map(|comment| {
                let anchored = comment.line - 1;
                let mark = if comment.orphaned {
                    HINT_MARK_ORPHANED
                } else {
                    HINT_MARK
                };
                InlayHint {
                    position: Position {
                        line: anchored as u32,
                        character: anchor::utf16_len(lines.get(anchored).copied().unwrap_or("")),
                    },
                    label: format!("{mark}{}", truncate(&comment.text)),
                    padding_left: true,
                    tooltip: MarkupContent {
                        kind: "markdown",
                        value: comment.text.clone(),
                    },
                }
            })
            .collect()
    }

    pub fn code_actions(&self, uri: &str, range: Range) -> Vec<CodeAction> {
        let Some(key) = self.key(uri) else {
            return Vec::new();
        };
        // The cursor line, in store terms. A selection spanning lines aims at its start.
        let line = range.start.line as usize + 1;
        let existing = self
            .store
            .comments(&key)
            .iter()
            .any(|comment| comment.line == line);

        let mut actions = Vec::new();
        if !existing {
            let title = "add comment".to_string();
            actions.push(CodeAction {
                title: title.clone(),
                kind: CODE_ACTION_KIND,
                command: Command {
                    title,
                    command: COMMAND_ADD.to_string(),
                    arguments: vec![json!(uri), json!(line)],
                },
            });
        }

        actions.extend(
            self.store
                .comments(&key)
                .iter()
                .filter(|comment| in_range(comment.line, range))
                .flat_map(|comment| {
                    let edit_title = format!("edit comment: {}", truncate(&comment.text));
                    let edit = CodeAction {
                        title: edit_title.clone(),
                        kind: CODE_ACTION_KIND,
                        command: Command {
                            title: edit_title,
                            command: COMMAND_ADD.to_string(),
                            arguments: vec![json!(uri), json!(comment.line)],
                        },
                    };
                    [edit, Self::delete_action(uri, comment)]
                }),
        );

        for (title, command) in [
            ("list comments", COMMAND_LIST),
            ("copy comments", COMMAND_COPY),
            ("reset comments", COMMAND_RESET),
        ] {
            actions.push(CodeAction {
                title: title.to_string(),
                kind: CODE_ACTION_KIND,
                command: Command {
                    title: title.to_string(),
                    command: command.to_string(),
                    arguments: Vec::new(),
                },
            });
        }
        actions
    }

    fn delete_action(uri: &str, comment: &Comment) -> CodeAction {
        let title = format!("delete comment: {}", truncate(&comment.text));
        CodeAction {
            title: title.clone(),
            kind: CODE_ACTION_KIND,
            command: Command {
                title,
                command: COMMAND_DELETE.to_string(),
                arguments: vec![json!(uri), json!(comment.line)],
            },
        }
    }

    pub fn execute_command(&mut self, command: &str, arguments: &[Value]) -> Vec<Effect> {
        match command {
            COMMAND_ADD => {
                let uri = arguments
                    .first()
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let line = arguments.get(1).and_then(Value::as_u64).unwrap_or(1) as usize;
                let Some(contents) = self.input_for(uri, line) else {
                    return Vec::new();
                };
                vec![
                    Effect::OpenInput { contents },
                    Effect::ShowMessage {
                        error: false,
                        text: format!(
                            "write the comment in {} and save",
                            display_path(&self.root, &self.input_path())
                        ),
                    },
                ]
            }
            COMMAND_LIST => {
                let moved = self.reconcile_all();
                let total = self.store.total();
                let mut effects = Vec::new();
                if moved {
                    effects.push(Effect::PersistStore);
                    effects.push(Effect::RefreshInlayHints);
                    effects.push(Effect::PublishDiagnostics);
                }
                effects.push(Effect::WriteExport);
                if total == 0 {
                    effects.push(Effect::ShowMessage {
                        error: false,
                        text: "no comments yet".to_string(),
                    });
                    return effects;
                }
                effects.push(Effect::OpenList {
                    contents: self.export_text(),
                });
                effects
            }
            COMMAND_DELETE => {
                let uri = arguments
                    .first()
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let line = arguments.get(1).and_then(Value::as_u64).unwrap_or_default() as usize;
                let Some(key) = self.key(uri) else {
                    return Vec::new();
                };
                if self.store.remove(&key, line) {
                    vec![
                        Effect::PersistStore,
                        Effect::RefreshInlayHints,
                        Effect::PublishDiagnostics,
                    ]
                } else {
                    Vec::new()
                }
            }
            COMMAND_COPY => {
                let moved = self.reconcile_all();
                let total = self.store.total();
                let mut effects = Vec::new();
                if moved {
                    effects.push(Effect::PersistStore);
                    effects.push(Effect::RefreshInlayHints);
                    effects.push(Effect::PublishDiagnostics);
                }
                effects.push(Effect::WriteExport);
                effects.push(Effect::ShowMessage {
                    error: false,
                    text: format!(
                        "{total} {} → {}",
                        plural(total, "comment", "comments"),
                        display_path(&self.root, &self.export_path())
                    ),
                });
                effects
            }
            COMMAND_RESET => {
                let total = self.store.total();
                if total == 0 {
                    return vec![Effect::ShowMessage {
                        error: false,
                        text: "no comments to reset".to_string(),
                    }];
                }
                let files = self.store.file_count();
                vec![Effect::AskResetConfirmation {
                    prompt: format!(
                        "Delete {total} {} in {files} {}?",
                        plural(total, "comment", "comments"),
                        plural(files, "file", "files")
                    ),
                }]
            }
            _ => Vec::new(),
        }
    }

    pub fn reset_confirmed(&mut self) -> Vec<Effect> {
        self.store.clear();
        vec![
            Effect::PersistStore,
            Effect::RefreshInlayHints,
            Effect::PublishDiagnostics,
        ]
    }
}

/// What a comment reads as on the line: the author's mark, the text, and the orphan note
/// when its anchor is gone.
fn message_of(comment: &Comment) -> String {
    let mark = match comment.author {
        Author::Agent => AGENT_MARK,
        Author::Human => "",
    };
    if comment.orphaned {
        format!("{mark}{} (orphaned)", comment.text)
    } else {
        format!("{mark}{}", comment.text)
    }
}

fn in_range(line: usize, range: Range) -> bool {
    let anchored = (line - 1) as u32;
    anchored >= range.start.line && anchored <= range.end.line
}

fn truncate(text: &str) -> String {
    if text.chars().count() <= HINT_WIDTH {
        return text.to_string();
    }
    let head: String = text.chars().take(HINT_WIDTH).collect();
    format!("{}…", head.trim_end())
}

fn plural(count: usize, one: &'static str, many: &'static str) -> &'static str {
    if count == 1 {
        one
    } else {
        many
    }
}

fn display_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

/// `file://` URI to a path, decoding percent escapes. Any other scheme is not served.
pub fn uri_to_path(uri: &str) -> Option<PathBuf> {
    let rest = uri.strip_prefix("file://")?;
    let rest = match rest.find('/') {
        Some(index) => &rest[index..],
        None => rest,
    };
    let mut decoded = Vec::with_capacity(rest.len());
    let bytes = rest.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).ok()?;
            if let Ok(byte) = u8::from_str_radix(hex, 16) {
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
    format!("file://{}", path.to_string_lossy())
}
