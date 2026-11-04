//! stdio transport: parse LSP messages, hand them to the session, send its answers.

use std::error::Error;
use std::path::{Path, PathBuf};
use std::process::Command;

use lsp_server::{Connection, ErrorCode, Message, Notification, Request, RequestId, Response};
use pr_comments::github::{switch_account, FetchError};
use pr_comments::{path_to_uri, uri_to_path, Session, COMMAND_LIST, COMMAND_OPEN, COMMAND_SYNC};
use serde_json::{json, Value};

const USAGE: &str = "\
pr-comments-lsp — GitHub PR review threads on the lines they target.

With no argument it speaks LSP over stdio and is started by the Zed extension.

  sync    read the threads of the PR of the current branch with `gh`, save them to
          .tmp/pr-comments.json, and write the list page .tmp/pr-comments.md
  list    write the list page from the threads of the last sync, and print its path";

fn main() -> Result<(), Box<dyn Error>> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match arguments.first().map(String::as_str) {
        None => serve(),
        Some(command @ ("sync" | "list")) => {
            let dir = std::env::current_dir()?;
            let Some(repo) = repo_of(&dir) else {
                eprintln!(
                    "pr-comments: {} is in no git repository. Focus a file of the PR's repository, then run it again.",
                    dir.display()
                );
                std::process::exit(1);
            };
            let mut session = Session::new(repo);
            let answer = if command == "sync" {
                session
                    .sync(&mut |percent, step| eprintln!("[{percent:>3}%] {step}"))
                    .map(|summary| format!("{summary}\n{}", session.list_path().display()))
                    .map_err(|error| error.to_string())
            } else {
                session.write_list().map(|path| path.display().to_string())
            };
            match answer {
                Ok(text) => {
                    println!("{text}");
                    Ok(())
                }
                Err(reason) => {
                    eprintln!("{reason}");
                    std::process::exit(1);
                }
            }
        }
        Some(_) => {
            println!("{USAGE}");
            Ok(())
        }
    }
}

/// The root of the git repository that holds `dir`.
fn repo_of(dir: &Path) -> Option<PathBuf> {
    Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(dir)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| PathBuf::from(String::from_utf8_lossy(&output.stdout).trim()))
}

fn serve() -> Result<(), Box<dyn Error>> {
    let (connection, io_threads) = Connection::stdio();
    let Some((id, params)) = await_initialize(&connection) else {
        return Ok(());
    };
    let root = params["rootUri"]
        .as_str()
        .and_then(uri_to_path)
        .or_else(|| params["rootPath"].as_str().map(PathBuf::from))
        .unwrap_or(std::env::current_dir()?);
    connection.initialize_finish(
        id,
        json!({
            "capabilities": {
                "textDocumentSync": { "openClose": true, "change": 1 },
                "codeActionProvider": true,
                "codeLensProvider": {},
                "executeCommandProvider": {
                    "commands": [COMMAND_SYNC, COMMAND_LIST, COMMAND_OPEN]
                }
            },
            "serverInfo": { "name": "pr-comments", "version": env!("CARGO_PKG_VERSION") }
        }),
    )?;
    let mut server = Server { connection, session: Session::new(repo_of(&root).unwrap_or(root)), next_id: 1, switch_question: None };
    server.watch_store();
    server.run();
    // The writer thread ends only when the last sender of the connection is gone.
    drop(server);
    io_threads.join()?;
    Ok(())
}

/// Wait for `initialize`. Returns None when the client gives up first: Zed starts and
/// drops a server whenever its extension fails to load, and a server that keeps waiting
/// then lives on with no client.
fn await_initialize(connection: &Connection) -> Option<(RequestId, Value)> {
    loop {
        match connection.receiver.recv() {
            Ok(Message::Request(request)) if request.method == "initialize" => {
                return Some((request.id, request.params));
            }
            Ok(Message::Request(request)) => {
                let shutdown = request.method == "shutdown";
                let _ = connection.sender.send(Message::Response(Response::new_err(
                    request.id,
                    ErrorCode::ServerNotInitialized as i32,
                    format!("pr-comments expected initialize, got {}", request.method),
                )));
                if shutdown {
                    return None;
                }
            }
            Ok(Message::Notification(notification)) if notification.method == "exit" => {
                return None;
            }
            Ok(_) => {}
            Err(_) => return None,
        }
    }
}

struct Server {
    connection: Connection,
    session: Session,
    next_id: i32,
    /// The id of the open "switch the gh account" dialog.
    switch_question: Option<RequestId>,
}

impl Server {
    fn run(&mut self) {
        while let Ok(message) = self.connection.receiver.recv() {
            match message {
                Message::Request(request) => {
                    if self.connection.handle_shutdown(&request).unwrap_or(true) {
                        return;
                    }
                    self.request(request);
                }
                Message::Notification(notification) => self.notification(notification),
                Message::Response(response) => self.answer(response),
            }
        }
    }

    fn request(&mut self, request: Request) {
        let Request { id, method, params } = request;
        let file = params["textDocument"]["uri"].as_str().and_then(uri_to_path);
        let result = match (method.as_str(), file) {
            ("textDocument/codeLens", Some(file)) => json!(self.session.code_lenses(&file)),
            ("textDocument/codeAction", _) => json!([
                { "title": "sync PR comments", "kind": "refactor",
                  "command": { "title": "sync PR comments", "command": COMMAND_SYNC } },
                { "title": "list PR comments", "kind": "refactor",
                  "command": { "title": "list PR comments", "command": COMMAND_LIST } }
            ]),
            ("workspace/executeCommand", _) => {
                let command = params["command"].as_str().unwrap_or_default().to_string();
                let argument = params["arguments"][0].as_str().unwrap_or_default().to_string();
                self.send(Message::Response(Response::new_ok(id, Value::Null)));
                self.execute(&command, &argument);
                return;
            }
            _ => Value::Null,
        };
        self.send(Message::Response(Response::new_ok(id, result)));
    }

    fn execute(&mut self, command: &str, argument: &str) {
        match command {
            COMMAND_SYNC => match self.sync_with_progress() {
                Ok(summary) => {
                    self.refresh();
                    self.show(false, summary);
                    self.show_list();
                }
                Err(error) => match &error {
                    FetchError::NoAccess { others, .. } if !others.is_empty() => {
                        let others = others.clone();
                        self.ask_switch(error.to_string(), others);
                    }
                    _ => self.show(true, error.to_string()),
                },
            },
            COMMAND_LIST => self.show_list(),
            COMMAND_OPEN => {
                if let Err(error) = Command::new("open").arg(argument).status() {
                    self.show(true, format!("pr-comments: cannot open {argument} ({error})"));
                }
            }
            _ => {}
        }
    }

    /// Sync, and show each step as language-server progress, which Zed puts in its status bar.
    fn sync_with_progress(&mut self) -> Result<String, FetchError> {
        let token = "pr-comments-sync";
        let id = self.request_id();
        self.send(Message::Request(Request {
            id,
            method: "window/workDoneProgress/create".to_string(),
            params: json!({ "token": token }),
        }));
        let sender = self.connection.sender.clone();
        let progress = |value: Value| {
            let _ = sender.send(Message::Notification(Notification {
                method: "$/progress".to_string(),
                params: json!({ "token": token, "value": value }),
            }));
        };
        progress(json!({ "kind": "begin", "title": "Syncing PR comments", "percentage": 0 }));
        let result = self.session.sync(&mut |percent, step| {
            progress(json!({ "kind": "report", "message": step, "percentage": percent }));
        });
        progress(json!({ "kind": "end" }));
        result
    }

    /// One button per account; the answer comes back in `answer`.
    fn ask_switch(&mut self, error: String, accounts: Vec<String>) {
        let id = self.request_id();
        let actions: Vec<Value> = accounts.iter().map(|login| json!({ "title": login })).collect();
        self.send(Message::Request(Request {
            id: id.clone(),
            method: "window/showMessageRequest".to_string(),
            params: json!({ "type": 1, "message": error, "actions": actions }),
        }));
        self.switch_question = Some(id);
    }

    /// A pressed account button switches gh to that account and syncs again.
    fn answer(&mut self, response: Response) {
        if self.switch_question.as_ref() != Some(&response.id) {
            return;
        }
        self.switch_question = None;
        let Some(login) = response.result.as_ref().and_then(|result| result["title"].as_str()) else {
            return;
        };
        match switch_account(self.session.repo(), login) {
            Ok(()) => self.execute(COMMAND_SYNC, ""),
            Err(reason) => self.show(true, reason),
        }
    }

    fn show_list(&mut self) {
        match self.session.write_list() {
            Ok(path) => {
                let id = self.request_id();
                self.send(Message::Request(Request {
                    id,
                    method: "window/showDocument".to_string(),
                    params: json!({ "uri": path_to_uri(&path), "takeFocus": true }),
                }));
            }
            Err(reason) => self.show(true, reason),
        }
    }

    /// A sync from a shell or a Zed task writes the store; the watch brings it here.
    fn watch_store(&mut self) {
        let id = self.request_id();
        let glob = self.session.store_path().to_string_lossy().into_owned();
        self.send(Message::Request(Request {
            id,
            method: "client/registerCapability".to_string(),
            params: json!({
                "registrations": [{
                    "id": "pr-comments-store",
                    "method": "workspace/didChangeWatchedFiles",
                    "registerOptions": { "watchers": [{ "globPattern": glob }] }
                }]
            }),
        }));
    }

    fn refresh(&mut self) {
        for file in self.session.open_files() {
            self.publish_diagnostics(&file);
        }
        let id = self.request_id();
        self.send(Message::Request(Request {
            id,
            method: "workspace/codeLens/refresh".to_string(),
            params: Value::Null,
        }));
    }

    fn notification(&mut self, notification: Notification) {
        let Notification { method, params } = notification;
        if method == "workspace/didChangeWatchedFiles" {
            self.session.reload();
            self.refresh();
            return;
        }
        let Some(file) = params["textDocument"]["uri"].as_str().and_then(uri_to_path) else {
            return;
        };
        let text = match method.as_str() {
            "textDocument/didOpen" => params["textDocument"]["text"].as_str(),
            "textDocument/didChange" => params["contentChanges"][0]["text"].as_str(),
            "textDocument/didClose" => None,
            _ => return,
        };
        self.session.set_buffer(&file, text.map(str::to_string));
        self.publish_diagnostics(&file);
    }

    fn publish_diagnostics(&mut self, file: &Path) {
        let diagnostics = self.session.diagnostics(file);
        self.send(Message::Notification(Notification {
            method: "textDocument/publishDiagnostics".to_string(),
            params: json!({ "uri": path_to_uri(file), "diagnostics": diagnostics }),
        }));
    }

    fn show(&mut self, error: bool, text: String) {
        self.send(Message::Notification(Notification {
            method: "window/showMessage".to_string(),
            params: json!({ "type": if error { 1 } else { 3 }, "message": text }),
        }));
    }

    fn request_id(&mut self) -> RequestId {
        self.next_id += 1;
        RequestId::from(self.next_id)
    }

    fn send(&self, message: Message) {
        let _ = self.connection.sender.send(message);
    }
}
