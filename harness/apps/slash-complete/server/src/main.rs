//! stdio transport: answer `textDocument/completion` in `.prompt` files with Claude slash names.

use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;

use lsp_server::{Connection, Message, Response};
use serde_json::{json, Value};
use slash_complete::{catalog, completion_items, slash_token_start};

const PROMPT_SUFFIX: &str = ".prompt";

fn main() -> Result<(), Box<dyn Error>> {
    if std::env::args().nth(1).as_deref() == Some("list") {
        for entry in catalog(&home()?, std::env::current_dir().ok().as_deref()) {
            println!("/{}\t{}\t{}", entry.name, entry.origin, entry.description);
        }
        return Ok(());
    }
    let (connection, io_threads) = Connection::stdio();
    let capabilities = json!({
        "textDocumentSync": 1,
        "completionProvider": { "triggerCharacters": ["/"] },
    });
    let params = connection.initialize(capabilities)?;
    let project = project_root(&params);
    let home = home()?;
    let mut documents: HashMap<String, String> = HashMap::new();
    for message in &connection.receiver {
        match message {
            Message::Request(request) => {
                if connection.handle_shutdown(&request)? {
                    break;
                }
                let result = if request.method == "textDocument/completion" {
                    complete(&request.params, &documents, &home, project.as_deref())
                } else {
                    Value::Null
                };
                connection.sender.send(Message::Response(Response::new_ok(request.id, result)))?;
            }
            Message::Notification(note) => {
                let uri = note.params["textDocument"]["uri"].as_str().unwrap_or_default().to_string();
                match note.method.as_str() {
                    "textDocument/didOpen" => {
                        let text = note.params["textDocument"]["text"].as_str().unwrap_or_default();
                        documents.insert(uri, text.to_string());
                    }
                    "textDocument/didChange" => {
                        if let Some(text) = note.params["contentChanges"]
                            .as_array()
                            .and_then(|changes| changes.last())
                            .and_then(|change| change["text"].as_str())
                        {
                            documents.insert(uri, text.to_string());
                        }
                    }
                    "textDocument/didClose" => {
                        documents.remove(&uri);
                    }
                    _ => {}
                }
            }
            Message::Response(_) => {}
        }
    }
    drop(connection);
    io_threads.join()?;
    Ok(())
}

fn complete(
    params: &Value,
    documents: &HashMap<String, String>,
    home: &std::path::Path,
    project: Option<&std::path::Path>,
) -> Value {
    let uri = params["textDocument"]["uri"].as_str().unwrap_or_default();
    if !uri.ends_with(PROMPT_SUFFIX) {
        return Value::Null;
    }
    let Some(text) = documents.get(uri) else { return Value::Null };
    let line = params["position"]["line"].as_u64().unwrap_or(0) as u32;
    let character = params["position"]["character"].as_u64().unwrap_or(0) as u32;
    let Some(line_text) = text.lines().nth(line as usize) else { return Value::Null };
    let Some(start) = slash_token_start(line_text, character) else { return Value::Null };
    completion_items(&catalog(home, project), line, start, character)
}

fn home() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "slash-complete-lsp: HOME is not set, so ~/.claude cannot be read".to_string())
}

fn project_root(params: &Value) -> Option<PathBuf> {
    let uri = params["workspaceFolders"][0]["uri"]
        .as_str()
        .or_else(|| params["rootUri"].as_str())?;
    uri.strip_prefix("file://").map(|path| PathBuf::from(percent_decode(path)))
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&text[i + 1..i + 3], 16) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
