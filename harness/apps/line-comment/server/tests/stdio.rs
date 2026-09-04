//! One end-to-end test over real stdio, proving the transport wiring.

use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::{json, Value};

struct Server {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    /// Requests the server made of us, kept so a test can assert on them.
    from_server: Vec<(String, Value)>,
    /// Notifications the server sent us, in order.
    notifications: Vec<Value>,
}

impl Server {
    fn start() -> Server {
        let mut child = Command::new(env!("CARGO_BIN_EXE_line-comment-lsp"))
            // Keep the test runs out of the diagnostic log a person reads.
            .env("LINE_COMMENT_LOG", "off")
            // A hand-over reveals its file in the editor. Under a test run that would
            // open a tab in the operator's own window.
            .env("LINE_COMMENT_ZED", "off")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("the server binary starts");
        let stdin = child.stdin.take().unwrap();
        let stdout = BufReader::new(child.stdout.take().unwrap());
        Server {
            child,
            stdin,
            stdout,
            from_server: Vec::new(),
            notifications: Vec::new(),
        }
    }

    fn send(&mut self, message: Value) {
        let body = serde_json::to_string(&message).unwrap();
        write!(self.stdin, "Content-Length: {}\r\n\r\n{body}", body.len()).unwrap();
        self.stdin.flush().unwrap();
    }

    fn receive(&mut self) -> Value {
        let mut length = 0usize;
        loop {
            let mut header = String::new();
            self.stdout.read_line(&mut header).unwrap();
            let trimmed = header.trim();
            if trimmed.is_empty() {
                break;
            }
            if let Some(value) = trimmed.strip_prefix("Content-Length:") {
                length = value.trim().parse().unwrap();
            }
        }
        let mut body = vec![0u8; length];
        self.stdout.read_exact(&mut body).unwrap();
        serde_json::from_slice(&body).unwrap()
    }

    /// Answer the server's own requests, and keep them, until our answer arrives.
    fn response(&mut self, id: i64) -> Value {
        loop {
            let message = self.receive();
            let is_answer = message.get("id").and_then(Value::as_i64) == Some(id)
                && message.get("method").is_none();
            if is_answer {
                return message;
            }
            if message.get("method").is_some() && message.get("id").is_none() {
                self.notifications.push(message.clone());
                continue;
            }
            if let (Some(request_id), Some(method)) = (message.get("id"), message.get("method")) {
                self.from_server.push((
                    method.as_str().unwrap_or_default().to_string(),
                    message.clone(),
                ));
                let result = if method == "workspace/applyEdit" {
                    json!({ "applied": true })
                } else {
                    Value::Null
                };
                self.send(json!({ "jsonrpc": "2.0", "id": request_id, "result": result }));
            }
        }
    }

    /// Read until the server makes this request, answering whatever else arrives.
    /// Effects are performed after the response, so a caller cannot rely on ordering.
    fn wait_for(&mut self, method: &str) -> Value {
        for _ in 0..50 {
            if let Some(seen) = self.asked_for(method) {
                return seen.clone();
            }
            let message = self.receive();
            if message.get("method").is_some() && message.get("id").is_none() {
                self.notifications.push(message.clone());
                continue;
            }
            if let (Some(request_id), Some(seen_method)) =
                (message.get("id"), message.get("method"))
            {
                self.from_server.push((
                    seen_method.as_str().unwrap_or_default().to_string(),
                    message.clone(),
                ));
                let result = if seen_method == "workspace/applyEdit" {
                    json!({ "applied": true })
                } else {
                    Value::Null
                };
                self.send(json!({ "jsonrpc": "2.0", "id": request_id, "result": result }));
            }
        }
        panic!("the server never sent {method}");
    }

    /// Poll until the process is gone, so a hang fails the test instead of stalling it.
    fn exited_within(&mut self, limit: Duration) -> bool {
        let deadline = Instant::now() + limit;
        while Instant::now() < deadline {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        false
    }

    fn asked_for(&self, method: &str) -> Option<&Value> {
        self.from_server
            .iter()
            .find(|(seen, _)| seen == method)
            .map(|(_, message)| message)
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}


/// The one input file the server minted under `.tmp/`, once it lands on disk.
fn wait_for_input(tmp: &Path) -> PathBuf {
    for _ in 0..200 {
        let found: Vec<PathBuf> = std::fs::read_dir(tmp)
            .into_iter()
            .flatten()
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("line-comment-input-"))
            })
            .collect();
        assert!(found.len() < 2, "more than one input file: {found:?}");
        if let Some(path) = found.into_iter().next() {
            return path;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    panic!("the server never wrote an input file");
}

#[test]
fn initialize_add_a_comment_through_the_input_file_and_read_back_a_hint() {
    let root = std::env::temp_dir().join(format!("line-comment-stdio-{}", std::process::id()));
    std::fs::create_dir_all(root.join("docs")).unwrap();
    let target = root.join("docs").join("spec.md");
    std::fs::write(&target, "# Title\n## Design\n").unwrap();
    let _ = std::fs::remove_dir_all(root.join(".tmp"));
    let uri = format!("file://{}", target.display());

    let mut server = Server::start();
    server.send(json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "capabilities": {},
            "workspaceFolders": [{ "uri": format!("file://{}", root.display()), "name": "root" }]
        }
    }));
    let initialized = server.response(1);
    let capabilities = &initialized["result"]["capabilities"];
    assert_eq!(capabilities["inlayHintProvider"], json!(true));
    assert_eq!(
        capabilities["executeCommandProvider"]["commands"],
        json!([
            "line-comment.add",
            "line-comment.list",
            "line-comment.delete",
            "line-comment.copy",
            "line-comment.reset"
        ])
    );
    assert_eq!(capabilities["renameProvider"], Value::Null);

    server.send(json!({ "jsonrpc": "2.0", "method": "initialized", "params": {} }));
    server.send(json!({
        "jsonrpc": "2.0",
        "method": "textDocument/didOpen",
        "params": { "textDocument": {
            "uri": uri, "languageId": "markdown", "version": 1, "text": "# Title\n## Design\n"
        }}
    }));

    // The code action on a clean line offers to add a comment.
    server.send(json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "textDocument/codeAction",
        "params": {
            "textDocument": { "uri": uri },
            "range": {
                "start": { "line": 1, "character": 0 },
                "end": { "line": 1, "character": 0 }
            },
            "context": { "diagnostics": [] }
        }
    }));
    let actions = server.response(2);
    let titles: Vec<&str> = actions["result"]
        .as_array()
        .unwrap()
        .iter()
        .map(|action| action["title"].as_str().unwrap())
        .collect();
    assert_eq!(
        titles,
        vec![
            "add comment",
            "list comments",
            "copy comments",
            "reset comments"
        ]
    );
    let command = actions["result"][0]["command"].clone();
    assert_eq!(command["command"], json!("line-comment.add"));

    // Running it writes the input file under .tmp/ — one file, no client edit, so the
    // reveal is the only thing that opens it.
    server.send(json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "workspace/executeCommand",
        "params": { "command": command["command"], "arguments": command["arguments"] }
    }));
    server.response(3);

    let input = wait_for_input(&root.join(".tmp"));
    assert_eq!(
        std::fs::read_to_string(&input).unwrap(),
        "<!-- line-comment: docs/spec.md:2 -->\n<!-- commenting on:\n## Design\n-->\n\n"
    );
    assert!(server.asked_for("workspace/applyEdit").is_none());
    server.wait_for("client/registerCapability");

    // The operator types and saves; the watch tells the server.
    std::fs::create_dir_all(input.parent().unwrap()).unwrap();
    std::fs::write(
        &input,
        "<!-- line-comment: docs/spec.md:2 -->\n\nneeds a source\n",
    )
    .unwrap();
    server.send(json!({
        "jsonrpc": "2.0",
        "method": "workspace/didChangeWatchedFiles",
        "params": { "changes": [{ "uri": format!("file://{}", input.display()), "type": 2 }] }
    }));

    server.send(json!({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "textDocument/inlayHint",
        "params": {
            "textDocument": { "uri": uri },
            "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 5, "character": 0 } }
        }
    }));
    let hints = server.response(4);
    assert_eq!(hints["result"].as_array().unwrap().len(), 1);
    assert_eq!(
        hints["result"][0]["label"],
        json!("\u{1f4ac} needs a source")
    );
    assert_eq!(
        hints["result"][0]["position"],
        json!({ "line": 0, "character": 7 })
    );

    assert!(
        !input.exists(),
        "the input file goes once its comment is stored"
    );
    assert!(root.join(".tmp").join("line-comment.json").exists());

    let published = server
        .notifications
        .iter()
        .rfind(|message| message["method"] == "textDocument/publishDiagnostics")
        .expect("the server publishes the comments as diagnostics");
    assert_eq!(
        published["params"]["diagnostics"][0]["message"],
        json!("needs a source")
    );
    assert_eq!(published["params"]["diagnostics"][0]["severity"], json!(4));
}

/// The path Claude uses: a `comment` subcommand process writes the store while the server
/// runs, and the watch notification makes the server publish it.
#[test]
fn a_comment_written_by_the_subcommand_reaches_the_editor() {
    let root = std::env::temp_dir().join(format!("line-comment-agent-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(root.join("src")).unwrap();
    // A git directory, so the subcommand resolves the same root the server was given.
    std::fs::create_dir_all(root.join(".git")).unwrap();
    let target = root.join("src").join("main.rs");
    let text = "fn main() {\n    let x = 1;\n}\n";
    std::fs::write(&target, text).unwrap();
    let uri = format!("file://{}", target.display());

    let mut server = Server::start();
    server.send(json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "capabilities": {},
            "workspaceFolders": [{ "uri": format!("file://{}", root.display()), "name": "root" }]
        }
    }));
    server.response(1);
    server.send(json!({ "jsonrpc": "2.0", "method": "initialized", "params": {} }));
    server.send(json!({
        "jsonrpc": "2.0",
        "method": "textDocument/didOpen",
        "params": { "textDocument": {
            "uri": uri, "languageId": "rust", "version": 1, "text": text
        }}
    }));
    server.wait_for("client/registerCapability");

    let written = Command::new(env!("CARGO_BIN_EXE_line-comment-lsp"))
        .args(["comment", "src/main.rs:2", "x is never reassigned"])
        .current_dir(&root)
        .output()
        .expect("the subcommand runs");
    assert!(
        written.status.success(),
        "{}",
        String::from_utf8_lossy(&written.stderr)
    );

    let store = root.join(".tmp").join("line-comment.json");
    server.send(json!({
        "jsonrpc": "2.0",
        "method": "workspace/didChangeWatchedFiles",
        "params": { "changes": [{ "uri": format!("file://{}", store.display()), "type": 2 }] }
    }));

    // A round trip proves the notification was processed before the assertions below.
    server.send(json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "textDocument/inlayHint",
        "params": {
            "textDocument": { "uri": uri },
            "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 5, "character": 0 } }
        }
    }));
    let hints = server.response(2);
    assert_eq!(hints["result"].as_array().unwrap().len(), 1);

    let published = server
        .notifications
        .iter()
        .rfind(|message| message["method"] == "textDocument/publishDiagnostics")
        .expect("the server republishes after the store changes");
    assert_eq!(published["params"]["uri"], json!(uri));
    assert_eq!(
        published["params"]["diagnostics"][0]["message"],
        json!("🤖 x is never reassigned")
    );
    assert_eq!(published["params"]["diagnostics"][0]["severity"], json!(4));
    assert_eq!(
        published["params"]["diagnostics"][0]["range"]["start"]["line"],
        json!(1)
    );

    // Dropping from the shell reaches the same live server: the comment goes and the
    // file's diagnostics are republished empty. No language-server restart in between.
    let dropped = Command::new(env!("CARGO_BIN_EXE_line-comment-lsp"))
        .args(["drop", "src/main.rs:2"])
        .current_dir(&root)
        .output()
        .expect("the subcommand runs");
    assert!(
        dropped.status.success(),
        "{}",
        String::from_utf8_lossy(&dropped.stderr)
    );
    assert_eq!(
        String::from_utf8_lossy(&dropped.stdout).trim(),
        "dropped src/main.rs:2"
    );

    server.send(json!({
        "jsonrpc": "2.0",
        "method": "workspace/didChangeWatchedFiles",
        "params": { "changes": [{ "uri": format!("file://{}", store.display()), "type": 2 }] }
    }));
    server.send(json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "textDocument/inlayHint",
        "params": {
            "textDocument": { "uri": uri },
            "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 5, "character": 0 } }
        }
    }));
    let hints = server.response(3);
    assert!(hints["result"].as_array().unwrap().is_empty());

    let published = server
        .notifications
        .iter()
        .rfind(|message| message["method"] == "textDocument/publishDiagnostics")
        .expect("the server republishes after the drop");
    assert_eq!(published["params"]["uri"], json!(uri));
    assert!(published["params"]["diagnostics"]
        .as_array()
        .unwrap()
        .is_empty());
}

/// Zed sends `shutdown` first on a server it spawned and then abandoned, which is what it
/// does to every server of an extension that failed to load. The process must end there:
/// waiting on the `initialize` that never comes leaks one live process per spawn.
#[test]
fn a_shutdown_before_initialize_ends_the_process() {
    let mut server = Server::start();
    server.send(json!({ "jsonrpc": "2.0", "id": 1, "method": "shutdown", "params": null }));

    let answer = server.response(1);
    assert_eq!(answer["error"]["code"], json!(-32002));

    assert!(
        server.exited_within(Duration::from_secs(5)),
        "the server still runs after a shutdown that arrived before initialize"
    );
}

/// The commit-view path. Zed attaches no language server to a past commit's buffers, so the
/// hand-over is asked for from a shell instead — with the path `editor::CopyFileLocation`
/// copies there, which is relative to the git repository and not to the Zed project above
/// it. The subcommand has to find the file anyway, and write the same input file a code
/// action would.
#[test]
fn add_hands_over_an_input_file_for_a_repository_relative_path() {
    let project = std::env::temp_dir().join(format!("line-comment-commit-{}", std::process::id()));
    let repository = project.join("pl");
    let file = repository.join("cmd").join("flags.go");
    std::fs::create_dir_all(file.parent().unwrap()).expect("the repository is created");
    std::fs::write(&file, "package flags\n\nfunc Auth() {}\n").expect("the file is written");
    // A worktree, as the real project is — the marker is a file, not a directory.
    std::fs::write(repository.join(".git"), "gitdir: elsewhere\n").expect("the marker is written");
    std::fs::create_dir_all(project.join(".tmp")).expect("the store directory is created");
    std::fs::write(project.join(".tmp").join("line-comment.json"), "{}").expect("a store exists");

    let handed = Command::new(env!("CARGO_BIN_EXE_line-comment-lsp"))
        .args(["add", "cmd/flags.go:3"])
        .current_dir(&project)
        .env("LINE_COMMENT_ZED", "off")
        .output()
        .expect("the subcommand runs");
    assert!(
        handed.status.success(),
        "{}",
        String::from_utf8_lossy(&handed.stderr)
    );

    let inputs: Vec<PathBuf> = std::fs::read_dir(project.join(".tmp"))
        .expect("the directory is readable")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("line-comment-input-"))
        })
        .collect();
    assert_eq!(inputs.len(), 1, "one input file was handed over");

    let written = std::fs::read_to_string(&inputs[0]).expect("the input file is readable");
    assert!(
        written.contains("pl/cmd/flags.go:3"),
        "the header names the file from the project root, not from the repository: {written}"
    );
    assert!(
        written.contains("func Auth() {}"),
        "the input file quotes the line it aims at: {written}"
    );
}

/// A name that no repository under the root holds is refused, and named in the refusal.
#[test]
fn add_refuses_a_path_that_names_no_file() {
    let project = std::env::temp_dir().join(format!("line-comment-missing-{}", std::process::id()));
    std::fs::create_dir_all(project.join(".tmp")).expect("the store directory is created");
    std::fs::write(project.join(".tmp").join("line-comment.json"), "{}").expect("a store exists");

    let refused = Command::new(env!("CARGO_BIN_EXE_line-comment-lsp"))
        .args(["add", "cmd/gone.go:3"])
        .current_dir(&project)
        .env("LINE_COMMENT_ZED", "off")
        .output()
        .expect("the subcommand runs");

    assert!(!refused.status.success(), "the subcommand fails");
    let said = String::from_utf8_lossy(&refused.stderr);
    assert!(
        said.contains("cmd/gone.go"),
        "the refusal names the path: {said}"
    );
}

/// Two worktrees of one repository hold the same repo-relative path, and the commit view
/// says nothing about which commit was on screen. The hand-over takes the first in path
/// order and tells the operator what else it matched, inside the block that is dropped on
/// save — so correcting it is editing the header, not running the command again.
#[test]
fn add_names_the_other_files_a_path_also_matches() {
    let project = std::env::temp_dir().join(format!("line-comment-two-{}", std::process::id()));
    for worktree in ["pl", "pl-stack"] {
        let file = project.join(worktree).join("cmd").join("flags.go");
        std::fs::create_dir_all(file.parent().unwrap()).expect("the worktree is created");
        std::fs::write(&file, "package flags\n\nfunc Auth() {}\n").expect("the file is written");
        std::fs::write(project.join(worktree).join(".git"), "gitdir: elsewhere\n")
            .expect("the marker is written");
    }
    std::fs::create_dir_all(project.join(".tmp")).expect("the store directory is created");
    std::fs::write(project.join(".tmp").join("line-comment.json"), "{}").expect("a store exists");

    let handed = Command::new(env!("CARGO_BIN_EXE_line-comment-lsp"))
        .args(["add", "cmd/flags.go:3"])
        .current_dir(&project)
        .env("LINE_COMMENT_ZED", "off")
        .output()
        .expect("the subcommand runs");
    assert!(
        handed.status.success(),
        "{}",
        String::from_utf8_lossy(&handed.stderr)
    );

    let input = std::fs::read_dir(project.join(".tmp"))
        .expect("the directory is readable")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("line-comment-input-"))
        })
        .expect("an input file was handed over");
    let written = std::fs::read_to_string(&input).expect("the input file is readable");

    assert!(
        written.starts_with("<!-- line-comment: pl/cmd/flags.go:3 -->"),
        "the first in path order is the target: {written}"
    );
    assert!(
        written.contains("pl-stack/cmd/flags.go"),
        "the other file is named: {written}"
    );
    // The note rides inside the quote block, so saving untouched still cancels.
    assert_eq!(
        line_comment::input::parse(&written)
            .expect("the header parses")
            .1,
        ""
    );
}
