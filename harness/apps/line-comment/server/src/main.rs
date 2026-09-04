//! stdio transport: parse LSP messages, hand them to the session, perform its effects.

use std::error::Error;
use std::path::{Path, PathBuf};

use line_comment::trace::Trace;
use line_comment::wire::{Change, Position, Range, RESET_CANCEL, RESET_CONFIRM};
use line_comment::{reveal, uri_to_path, Effect, Session};
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, RequestId, Response};
use serde_json::{json, Value};

const USAGE: &str = "\
line-comment-lsp — line comments kept outside the file.

With no argument it speaks LSP over stdio and is started by the Zed extension.
The subcommands write the same store from a shell, for Claude to place comments:

  comment <file>:<lines> <text>  attach a comment, replacing the one that starts there;
                                 <lines> is 12 for one line or 12-18 for a span
  add <file>:<lines>             open an input file for that target and reveal it, for the
                                 operator to type into — the way into a commit view, where
                                 Zed offers no code action
  drop <file>:<line>...          remove the comment starting on each of those lines
  drop --all                     remove every comment in the workspace
  list                           print every comment in the export format
  store                          print the path of the store these commands read

A running server picks the change up through its watch on the store.";

fn main() -> Result<(), Box<dyn Error>> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    if let Some(first) = arguments.first() {
        let rest = &arguments[1..];
        let answered = match first.as_str() {
            "--version" | "-V" => Some(Ok(format!(
                "line-comment-lsp {}",
                env!("CARGO_PKG_VERSION")
            ))),
            "--help" | "-h" | "help" => Some(Ok(USAGE.to_string())),
            "comment" => Some(match rest {
                [target, text @ ..] if !text.is_empty() => {
                    line_comment::cli::comment(target, &text.join(" "))
                        .map(|placed| format!("commented {placed}"))
                }
                _ => Err("usage: line-comment-lsp comment <file>:<lines> <text>".to_string()),
            }),
            "add" => Some(match rest {
                [target] => line_comment::cli::add(target)
                    .map(|path| format!("write the comment in {path} and save")),
                _ => Err("usage: line-comment-lsp add <file>:<lines>".to_string()),
            }),
            "drop" => Some(match rest {
                [flag] if flag == "--all" => line_comment::cli::drop_all(),
                targets if !targets.is_empty() => line_comment::cli::drop_comments(targets),
                _ => Err("usage: line-comment-lsp drop <file>:<line>... | --all".to_string()),
            }),
            "list" => Some(line_comment::cli::list()),
            "store" => Some(line_comment::cli::store_path()),
            _ => None,
        };
        if let Some(answer) = answered {
            match answer {
                Ok(text) => {
                    println!("{}", text.trim_end());
                    return Ok(());
                }
                Err(reason) => {
                    eprintln!("line-comment-lsp: {reason}");
                    std::process::exit(1);
                }
            }
        }
    }

    let (connection, io_threads) = Connection::stdio();

    // The trace opens before the handshake, so a server the client spawns and never
    // initializes still says so in the log.
    let mut trace = Trace::open();
    trace.write("spawn");

    let Some((id, params)) = await_initialize(&connection, &mut trace) else {
        return Ok(());
    };
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
                        "line-comment.add",
                        "line-comment.list",
                        "line-comment.delete",
                        "line-comment.copy",
                        "line-comment.reset"
                    ]
                },
                "inlayHintProvider": true
            },
            "serverInfo": { "name": "line-comment", "version": env!("CARGO_PKG_VERSION") }
        }),
    )?;

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

/// Wait for `initialize`, and answer every other request with `ServerNotInitialized`.
///
/// Returns None when the client gave up on the handshake, so the caller exits instead of
/// waiting forever. `Connection::initialize_start` answers a pre-initialize `shutdown` and
/// then keeps waiting, which leaks one live process per spawn. Zed spawns and abandons a
/// server whenever its extension fails to load.
fn await_initialize(connection: &Connection, trace: &mut Trace) -> Option<(RequestId, Value)> {
    loop {
        match connection.receiver.recv() {
            Ok(Message::Request(request)) if request.method == "initialize" => {
                return Some((request.id, request.params));
            }
            Ok(Message::Request(request)) => {
                let method = request.method.clone();
                trace.write(&format!("before initialize request {method}"));
                let response = Response::new_err(
                    request.id,
                    ErrorCode::ServerNotInitialized as i32,
                    format!("line-comment expected initialize, got {method}"),
                );
                let _ = connection.sender.send(Message::Response(response));
                if method == "shutdown" {
                    trace.write("exit before initialize");
                    return None;
                }
            }
            Ok(Message::Notification(notification)) => {
                trace.write(&format!("before initialize notify {}", notification.method));
                if notification.method == "exit" {
                    trace.write("exit before initialize");
                    return None;
                }
            }
            Ok(Message::Response(_)) => {}
            Err(_) => {
                trace.write("disconnected before initialize");
                return None;
            }
        }
    }
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
        .unwrap_or_else(|| std::env::temp_dir().join("line-comment"))
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
            Message::Response(response) => {
                let answer = response
                    .result
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "no result".to_string());
                self.trace.write(&format!("client answered {answer}"));
                false
            }
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
            // One watch covers the input file and the store, so the notification does not
            // say which moved. Both are cheap to re-read, so both are read.
            //
            // The store is read first. A drain leaves its comment in memory and persists
            // it only when the effects run, so reloading afterwards would read the file
            // as it stood before the drain and throw that comment away.
            "workspace/didChangeWatchedFiles" => {
                let mut effects = self.session.reload_store();
                effects.extend(self.session.drain_input());
                effects
            }
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
                            format!("line-comment: cannot write the store ({error})"),
                        );
                    }
                }
                Effect::WriteExport => {
                    if let Err(error) = self.session.write_export() {
                        self.show(
                            true,
                            format!("line-comment: cannot write the export ({error})"),
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
                Effect::OpenInput { path, contents } => self.open_input(path, contents),
                Effect::WatchFiles => self.watch_files(),
                Effect::PublishDiagnostics => self.publish_diagnostics(),
                Effect::OpenList { path, contents } => self.open_list(path, contents),
            }
        }
    }

    /// Write the input file and bring it up.
    ///
    /// The write is direct, not a `workspace/applyEdit`: an edit makes the client open the
    /// file too, and with the reveal below that is the same file opened twice.
    ///
    /// The path is one no earlier comment used, so nothing holds a buffer on it.
    fn open_input(&mut self, path: PathBuf, contents: String) {
        self.hand_over(path, contents, "open input");
    }

    /// Put a handed-over file in front of the operator through the Zed CLI — the one
    /// mechanism that works over a review multibuffer as well as a plain tab.
    ///
    /// `window/showDocument`, the request that asks the client for this, is one Zed
    /// leaves unanswered. So the editor is asked from outside.
    fn reveal_in_editor(&mut self, path: &Path) {
        let Some(program) = reveal::zed_cli() else {
            self.trace.write("reveal: no zed cli");
            return;
        };
        match reveal::with(&program, path) {
            // The CLI exits as soon as the running editor takes the path. Waiting for it
            // in a thread of its own reaps it without holding the message loop.
            Ok(mut child) => {
                self.trace
                    .write(&format!("reveal {}", program.to_string_lossy()));
                std::thread::spawn(move || {
                    let _ = child.wait();
                });
            }
            Err(error) => self.trace.write(&format!("reveal failed: {error}")),
        }
    }

    /// Ask the client to watch the input files and the store. Without this the server
    /// only learns of a write when the file happens to be an open buffer the client
    /// reports — and the `comment` subcommand writes the store with no editor at all.
    ///
    /// The input files are watched as a pattern, because each comment gets a file of its
    /// own and the names are minted after this registration.
    fn watch_files(&mut self) {
        let id = self.request_id();
        let globs = [self.session.input_glob(), self.session.store_path()]
            .map(|path| path.to_string_lossy().to_string());
        let watchers: Vec<Value> = globs
            .iter()
            .map(|glob| json!({ "globPattern": glob }))
            .collect();
        self.send(Message::Request(Request {
            id,
            method: "client/registerCapability".to_string(),
            params: json!({
                "registrations": [{
                    "id": "line-comment-files",
                    "method": "workspace/didChangeWatchedFiles",
                    "registerOptions": { "watchers": watchers }
                }]
            }),
        }));
        self.trace.write(&format!("watch {}", globs.join(" ")));
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

    /// Hand over a rendered view the same way as the input file. The export on disk is
    /// never touched here — the Claude command reads that one.
    fn open_list(&mut self, path: PathBuf, contents: String) {
        self.hand_over(path, contents, "open list");
    }

    /// Put the contents on disk, then ask the editor for the path.
    fn hand_over(&mut self, path: PathBuf, contents: String, what: &str) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Err(error) = std::fs::write(&path, contents) {
            self.show(true, format!("line-comment: cannot write {} ({error})", path.display()));
            return;
        }
        self.trace.write(&format!("{what} {}", path.display()));
        self.reveal_in_editor(&path);
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
