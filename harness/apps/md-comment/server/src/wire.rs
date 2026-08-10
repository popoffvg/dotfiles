//! The subset of the LSP wire format this server produces.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MarkupContent {
    pub kind: &'static str,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InlayHint {
    pub position: Position,
    pub label: String,
    pub padding_left: bool,
    pub tooltip: MarkupContent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Command {
    pub title: String,
    pub command: String,
    pub arguments: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CodeAction {
    pub title: String,
    pub kind: &'static str,
    pub command: Command,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    pub range: Range,
    /// 4 is Hint — the quietest severity, and the one the editor filters last.
    pub severity: u8,
    pub source: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublishDiagnostics {
    pub uri: String,
    pub diagnostics: Vec<Diagnostic>,
}

/// One incremental document change. `range` is `None` for a whole-document replacement.
#[derive(Debug, Clone)]
pub struct Change {
    pub range: Option<(u32, u32, u32, u32)>,
    pub text: String,
}

pub const CODE_ACTION_KIND: &str = "refactor";
pub const DIAGNOSTIC_SOURCE: &str = "md-comment";
pub const SEVERITY_HINT: u8 = 4;
pub const COMMAND_ADD: &str = "md-comment.add";
pub const COMMAND_LIST: &str = "md-comment.list";
pub const COMMAND_DELETE: &str = "md-comment.delete";
pub const COMMAND_COPY: &str = "md-comment.copy";
pub const COMMAND_RESET: &str = "md-comment.reset";
pub const RESET_CONFIRM: &str = "Delete";
pub const RESET_CANCEL: &str = "Cancel";
