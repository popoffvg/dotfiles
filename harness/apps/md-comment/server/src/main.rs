//! stdio transport: parse LSP messages, hand them to the session, perform its effects.

use std::error::Error;
use std::path::PathBuf;

use lsp_server::{Connection, Message, Notification, Request, RequestId, Response};
use md_comment::trace::Trace;
use md_comment::wire::{Change, Position, Range, RESET_CANCEL, RESET_CONFIRM};
use md_comment::{uri_to_path, Effect, Session};
use serde_json::{json, Value};

fn main() -> Result<(), Box<dyn Error>> {
    // The server speaks LSP over stdio. Answer the two flags a human is likely to try,
    // so a hand-run binary explains itself instead of failing on an empty channel.
    if let Some(flag) = std::env::args().nth(1) {
        match flag.as_str() {
            "--version" | "-V" => {
                println!("md-comment-lsp {}", env!("CARGO_PKG_VERSION"));
                return Ok(());
            }
            "--help" | "-h" => {
                println!(
                    "md-comment-lsp {} — a language server for markdown comments.\n\
                     It speaks LSP over stdio and is started by the Zed extension, not by hand.",
                    env!("CARGO_PKG_VERSION")
                );
                return Ok(());
            }
            _ => {}
        }
    }

    let (connection, io_threads) = Connection::stdio();
    let (id, params) = connection.initialize_start()?;
    let root = workspace_root(&params);

    connection.initialize_finish(
        id,
        json!({
            "capabilities": {
                "textDocumentSync": {
                    "openClose": true,
                    "change": 2,
                    "save": { "includeText": false }
                },
                "codeActionProvider": { "codeActionKinds": ["refactor"] },
                "executeCommandProvider": {
                    "commands": [
                        "md-comment.add",
                        "md-comment.list",
                        "md-comment.delete",
                        "md-comment.copy",
                        "md-comment.reset"
                    ]
                },
                "inlayHintProvider": true
            },
            "serverInfo": { "name": "md-comment", "version": env!("CARGO_PKG_VERSION") }
        }),
    )?;

    let mut trace = Trace::open();
    trace.write(&format!("start root={}", root.display()));

    let (session, effects) = Session::new(root);
    let mut server = Server {
        connection,
        session,
        next_id: 1,
        trace,
    };
    server.perform(effects);
    server.run();
    io_threads.join()?;
    Ok(())
}

/// `workspaceFolders[0]`, then `rootUri`, then `rootPath`; a temporary directory otherwise.
fn workspace_root(params: &Value) -> PathBuf {
    let folder = params
        .get("workspaceFolders")
        .and_then(Value::as_array)
        .and_then(|folders| folders.first())
        .and_then(|folder| folder.get("uri"))
        .and_then(Value::as_str)
        .and_then(uri_to_path);
    let root_uri = params
        .get("rootUri")
        .and_then(Value::as_str)
        .and_then(uri_to_path);
    let root_path = params
        .get("rootPath")
        .and_then(Value::as_str)
        .map(PathBuf::from);
    folder
        .or(root_uri)
        .or(root_path)
        .unwrap_or_else(|| std::env::temp_dir().join("md-comment"))
}

struct Server {
    connection: Connection,
    session: Session,
    next_id: i32,
    trace: Trace,
}

impl Server {
    fn run(&mut self) {
        while let Ok(message) = self.connection.receiver.recv() {
            if self.handle(message) {
                break;
            }
        }
        self.trace.write("exit");
    }

    /// Returns true when the client asked the server to shut down.
    fn handle(&mut self, message: Message) -> bool {
        match message {
            Message::Request(request) => {
                if self.connection.handle_shutdown(&request).unwrap_or(true) {
                    self.trace.write("shutdown");
                    return true;
                }
                self.request(request);
                false
            }
            Message::Notification(notification) => {
                self.notification(notification);
                false
            }
            Message::Response(_) => false,
        }
    }

    fn request(&mut self, request: Request) {
        let Request { id, method, params } = request;
        let served = match self.session.key(&uri(&params)) {
            Some(key) => key,
            None => format!("(not served) {}", uri(&params)),
        };
        self.trace.write(&format!("request {method} {served}"));
        let (result, effects) = match method.as_str() {
            "textDocument/inlayHint" => {
                let hints = self.session.inlay_hints(&uri(&params), range(&params));
                (to_value(Some(hints)), Vec::new())
            }
            "textDocument/codeAction" => {
                let actions = self.session.code_actions(&uri(&params), range(&params));
                (to_value(Some(actions)), Vec::new())
            }
            "workspace/executeCommand" => {
                let command = params
                    .get("command")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let arguments = params
                    .get("arguments")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                (
                    Value::Null,
                    self.session.execute_command(&command, &arguments),
                )
            }
            _ => (Value::Null, Vec::new()),
        };

        let summary = match &result {
            Value::Null => "null".to_string(),
            Value::Array(items) => format!("{} items", items.len()),
            other => other.to_string(),
        };
        self.trace.write(&format!("answer  {method} {summary}"));

        self.send(Message::Response(Response {
            id,
            result: Some(result),
            error: None,
        }));
        self.perform(effects);
    }

    fn notification(&mut self, notification: Notification) {
        let Notification { method, params } = notification;
        self.trace.write(&format!("notify  {method}"));
        let effects = match method.as_str() {
            "textDocument/didOpen" => {
                let document = params.get("textDocument").cloned().unwrap_or(Value::Null);
                let text = document
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let uri = document
                    .get("uri")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                self.session.did_open(&uri, text)
            }
            "textDocument/didChange" => {
                let changes: Vec<Change> = params
                    .get("contentChanges")
                    .and_then(Value::as_array)
                    .map(|items| items.iter().map(change).collect())
                    .unwrap_or_default();
                self.session.did_change(&uri(&params), &changes)
            }
            "textDocument/didSave" => self.session.did_save(&uri(&params)),
            "textDocument/didClose" => {
                self.session.did_close(&uri(&params));
                Vec::new()
            }
            // The watch fires on any change to the input file, open in an editor or not.
            "workspace/didChangeWatchedFiles" => self.session.drain_input(),
            _ => Vec::new(),
        };
        self.perform(effects);
    }

    fn perform(&mut self, effects: Vec<Effect>) {
        for effect in effects {
            match effect {
                Effect::PersistStore => {
                    if let Err(error) = self.session.persist() {
                        self.show(
                            true,
                            format!("md-comment: cannot write the store ({error})"),
                        );
                    }
                }
                Effect::WriteExport => {
                    if let Err(error) = self.session.write_export() {
                        self.show(
                            true,
                            format!("md-comment: cannot write the export ({error})"),
                        );
                    }
                }
                Effect::RefreshInlayHints => {
                    let id = self.request_id();
                    self.send(Message::Request(Request {
                        id,
                        method: "workspace/inlayHint/refresh".to_string(),
                        params: Value::Null,
                    }));
                }
                Effect::ShowMessage { error, text } => self.show(error, text),
                Effect::AskResetConfirmation { prompt } => self.ask_reset(prompt),
                Effect::OpenInput { contents } => self.open_input(contents),
                Effect::WatchInput => self.watch_input(),
                Effect::PublishDiagnostics => self.publish_diagnostics(),
                Effect::OpenList { contents } => self.open_list(contents),
            }
        }
    }

    /// Create the input file through the client, so the client puts it in front of the
    /// operator. A create alone opens nothing — the text edit is what makes the
    /// transaction non-empty, and non-empty is what the editor shows.
    fn open_input(&mut self, contents: String) {
        let path = self.session.input_path();
        let uri = md_comment::path_to_uri(&path);
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        // Start from empty so the edit below is the whole content, whatever was there.
        let _ = std::fs::write(&path, "");

        let id = self.request_id();
        self.send(Message::Request(Request {
            id,
            method: "workspace/applyEdit".to_string(),
            params: json!({
                "label": "md-comment: write a comment",
                "edit": {
                    "documentChanges": [
                        { "kind": "create", "uri": uri, "options": { "ignoreIfExists": true } },
                        {
                            "textDocument": { "uri": uri, "version": null },
                            "edits": [{
                                "range": {
                                    "start": { "line": 0, "character": 0 },
                                    "end": { "line": 0, "character": 0 }
                                },
                                "newText": contents
                            }]
                        }
                    ]
                }
            }),
        }));
        self.trace.write(&format!("open input {}", path.display()));
    }

    /// Ask the client to watch the input file. Without this the server only learns of a
    /// save when the file happens to be an open buffer the client reports.
    fn watch_input(&mut self) {
        let id = self.request_id();
        let glob = self.session.input_path().to_string_lossy().to_string();
        self.send(Message::Request(Request {
            id,
            method: "client/registerCapability".to_string(),
            params: json!({
                "registrations": [{
                    "id": "md-comment-input",
                    "method": "workspace/didChangeWatchedFiles",
                    "registerOptions": { "watchers": [{ "globPattern": glob }] }
                }]
            }),
        }));
        self.trace.write(&format!("watch {glob}"));
    }

    /// Ask the client, then act on the answer. Messages that arrive meanwhile are
    /// handled after the answer, in the order they came.
    fn ask_reset(&mut self, prompt: String) {
        let id = self.request_id();
        self.send(Message::Request(Request {
            id: id.clone(),
            method: "window/showMessageRequest".to_string(),
            params: json!({
                "type": 3,
                "message": prompt,
                "actions": [{ "title": RESET_CONFIRM }, { "title": RESET_CANCEL }]
            }),
        }));

        let mut deferred = Vec::new();
        let mut confirmed = false;
        while let Ok(message) = self.connection.receiver.recv() {
            match message {
                Message::Response(response) if response.id == id => {
                    confirmed = response
                        .result
                        .as_ref()
                        .and_then(|value| value.get("title"))
                        .and_then(Value::as_str)
                        == Some(RESET_CONFIRM);
                    break;
                }
                other => deferred.push(other),
            }
        }

        if confirmed {
            let effects = self.session.reset_confirmed();
            self.perform(effects);
        }
        for message in deferred {
            self.handle(message);
        }
    }

    fn publish_diagnostics(&mut self) {
        for payload in self.session.diagnostics() {
            let count = payload.diagnostics.len();
            self.send(Message::Notification(Notification {
                method: "textDocument/publishDiagnostics".to_string(),
                params: serde_json::to_value(&payload).unwrap_or(Value::Null),
            }));
            self.trace
                .write(&format!("publish {count} diagnostics {}", payload.uri));
        }
    }

    /// Hand over a rendered view the same way as the input file: empty it, then let the
    /// client apply the text, which is what makes it open the file. The export on disk is
    /// never touched here — the Claude command reads that one.
    fn open_list(&mut self, contents: String) {
        let path = self.session.list_path();
        let uri = md_comment::path_to_uri(&path);
        let id = self.request_id();
        self.send(Message::Request(Request {
            id,
            method: "workspace/applyEdit".to_string(),
            params: json!({
                "label": "md-comment: the comments so far",
                "edit": {
                    "documentChanges": [
                        { "kind": "create", "uri": uri, "options": { "overwrite": true } },
                        {
                            "textDocument": { "uri": uri, "version": null },
                            "edits": [{
                                "range": {
                                    "start": { "line": 0, "character": 0 },
                                    "end": { "line": 0, "character": 0 }
                                },
                                "newText": contents
                            }]
                        }
                    ]
                }
            }),
        }));
        self.trace.write(&format!("open list {}", path.display()));
    }

    fn show(&mut self, error: bool, text: String) {
        let level = if error { 1 } else { 3 };
        self.send(Message::Notification(Notification {
            method: "window/showMessage".to_string(),
            params: json!({ "type": level, "message": text }),
        }));
    }

    fn request_id(&mut self) -> RequestId {
        let id = self.next_id;
        self.next_id += 1;
        RequestId::from(id)
    }

    fn send(&self, message: Message) {
        let _ = self.connection.sender.send(message);
    }
}

fn uri(params: &Value) -> String {
    params
        .get("textDocument")
        .and_then(|document| document.get("uri"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn range(params: &Value) -> Range {
    let range = params.get("range");
    Range {
        start: read_position(range.and_then(|r| r.get("start"))),
        end: read_position(range.and_then(|r| r.get("end"))),
    }
}

fn read_position(value: Option<&Value>) -> Position {
    Position {
        line: value
            .and_then(|v| v.get("line"))
            .and_then(Value::as_u64)
            .unwrap_or_default() as u32,
        character: value
            .and_then(|v| v.get("character"))
            .and_then(Value::as_u64)
            .unwrap_or_default() as u32,
    }
}

fn change(value: &Value) -> Change {
    let text = value
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let range = value.get("range").map(|range| {
        let start = read_position(range.get("start"));
        let end = read_position(range.get("end"));
        (start.line, start.character, end.line, end.character)
    });
    Change { range, text }
}

fn to_value<T: serde::Serialize>(value: Option<T>) -> Value {
    match value {
        Some(value) => serde_json::to_value(value).unwrap_or(Value::Null),
        None => Value::Null,
    }
}
