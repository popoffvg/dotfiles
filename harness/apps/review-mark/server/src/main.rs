use std::collections::HashMap;
use std::error::Error;

use line_comment::uri_to_path;
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, RequestId, Response};
use review_mark::git::{self, RepoFile};
use review_mark::hunks::{hunk_at, hunks, Hunk};
use review_mark::store::{store_path, Store};
use review_mark::view::{FileView, TOGGLE_FILE, TOGGLE_HUNK};
use serde_json::{json, Value};

fn main() -> Result<(), Box<dyn Error>> {
    let (connection, io_threads) = Connection::stdio();
    connection.initialize(json!({
        "textDocumentSync": { "openClose": true, "change": 1 },
        "codeLensProvider": {},
        "codeActionProvider": { "codeActionKinds": ["refactor"] },
        "executeCommandProvider": { "commands": [TOGGLE_HUNK, TOGGLE_FILE] }
    }))?;
    let mut server = Server { connection, documents: HashMap::new(), next_id: 0 };
    server.register_symbols();
    server.run()?;
    io_threads.join()?;
    Ok(())
}

/// The review state of one buffer, read fresh from git and the store on every request,
/// so a commit or another window's toggle shows on the next request.
struct Loaded {
    file: RepoFile,
    hunks: Vec<Hunk>,
    store: Store,
    line_count: u32,
}

/// An open buffer. `file` and `base` come from git on didOpen and on a toggle only,
/// so a commit made outside Zed shows after the next toggle or reopen.
struct Document {
    text: String,
    file: Option<RepoFile>,
    base: String,
}

struct Server {
    connection: Connection,
    documents: HashMap<String, Document>,
    next_id: i32,
}

impl Server {
    fn run(&mut self) -> Result<(), Box<dyn Error>> {
        while let Ok(message) = self.connection.receiver.recv() {
            match message {
                Message::Request(request) => {
                    if self.connection.handle_shutdown(&request)? {
                        return Ok(());
                    }
                    self.request(request);
                }
                Message::Notification(notification) => self.notification(notification),
                Message::Response(_) => {}
            }
        }
        Ok(())
    }

    fn request(&mut self, request: Request) {
        let params = &request.params;
        let uri = params["textDocument"]["uri"].as_str().unwrap_or_default();
        let result = match request.method.as_str() {
            "textDocument/codeLens" => self.render(uri, |view| view.lenses()),
            "textDocument/documentSymbol" => self.render(uri, |view| view.symbols()),
            "textDocument/codeAction" => {
                let line = params["range"]["start"]["line"].as_u64().unwrap_or_default() as u32;
                self.render(uri, |view| view.actions(line))
            }
            "workspace/executeCommand" => {
                self.execute(params["command"].as_str().unwrap_or_default(), &params["arguments"]);
                Value::Null
            }
            method => {
                let error = Response::new_err(request.id, ErrorCode::MethodNotFound as i32, method.to_string());
                return self.send(Message::Response(error));
            }
        };
        self.send(Message::Response(Response::new_ok(request.id, result)));
    }

    fn notification(&mut self, notification: Notification) {
        let params = notification.params;
        let uri = params["textDocument"]["uri"].as_str().unwrap_or_default().to_string();
        match notification.method.as_str() {
            "textDocument/didOpen" => {
                let text = params["textDocument"]["text"].as_str().unwrap_or_default();
                let file = uri_to_path(&uri).and_then(|path| git::locate(&path));
                let base = file.as_ref().map(git::head_text).unwrap_or_default();
                self.documents.insert(uri, Document { text: text.to_string(), file, base });
            }
            "textDocument/didChange" => {
                let change = params["contentChanges"].as_array().and_then(|changes| changes.last());
                if let (Some(change), Some(document)) = (change, self.documents.get_mut(&uri)) {
                    document.text = change["text"].as_str().unwrap_or_default().to_string();
                }
            }
            "textDocument/didClose" => {
                self.documents.remove(&uri);
            }
            _ => {}
        }
    }

    fn load(&self, uri: &str) -> Option<Loaded> {
        let document = self.documents.get(uri)?;
        let file = document.file.as_ref()?;
        Some(Loaded {
            file: file.clone(),
            hunks: hunks(&document.base, &document.text),
            store: Store::load(&store_path(&file.repo)),
            line_count: document.text.lines().count() as u32,
        })
    }

    fn render(&self, uri: &str, part: impl Fn(&FileView) -> Vec<Value>) -> Value {
        let Some(loaded) = self.load(uri) else {
            return json!([]);
        };
        let view = FileView {
            uri,
            path: &loaded.file.path,
            line_count: loaded.line_count,
            hunks: &loaded.hunks,
            store: &loaded.store,
        };
        Value::from(part(&view))
    }

    fn execute(&mut self, command: &str, arguments: &Value) {
        let uri = arguments[0].as_str().unwrap_or_default();
        if let Some(document) = self.documents.get_mut(uri) {
            document.base = document.file.as_ref().map(git::head_text).unwrap_or_default();
        }
        let Some(mut loaded) = self.load(uri) else {
            return self.show(format!("review-mark: {uri} is not a changed file in a git work tree"));
        };
        let path = &loaded.file.path;
        match command {
            TOGGLE_FILE => loaded.store.toggle_file(path, &loaded.hunks),
            _ => {
                let line = arguments[1].as_u64().unwrap_or_default() as u32;
                let Some(hunk) = hunk_at(&loaded.hunks, line) else {
                    return self.show(format!("review-mark: line {} of {path} is in no hunk", line + 1));
                };
                loaded.store.toggle_hunk(path, hunk);
            }
        }
        if let Err(error) = loaded.store.save(&store_path(&loaded.file.repo)) {
            return self.show(format!("review-mark: cannot write the store ({error})"));
        }
        self.ask("workspace/codeLens/refresh", Value::Null);
        self.register_symbols();
    }

    /// Zed has no request to refresh document symbols. It re-reads them when a
    /// registration changes, so every toggle registers the provider again with a new label.
    fn register_symbols(&mut self) {
        let label = format!("review-mark {}", self.next_id);
        self.ask(
            "client/registerCapability",
            json!({ "registrations": [{
                "id": "review-mark-symbols",
                "method": "textDocument/documentSymbol",
                "registerOptions": { "documentSelector": null, "label": label }
            }]}),
        );
    }

    fn show(&self, message: String) {
        let params = json!({ "type": 1, "message": message });
        self.send(Message::Notification(Notification::new("window/showMessage".to_string(), params)));
    }

    fn ask(&mut self, method: &str, params: Value) {
        self.next_id += 1;
        let id = RequestId::from(format!("review-mark-{}", self.next_id));
        self.send(Message::Request(Request::new(id, method.to_string(), params)));
    }

    fn send(&self, message: Message) {
        let _ = self.connection.sender.send(message);
    }
}
