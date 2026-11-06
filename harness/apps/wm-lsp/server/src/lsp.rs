use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;

use lsp_server::{Connection, Message, Notification, Request, Response};
use lsp_types::notification::{DidChangeTextDocument, DidCloseTextDocument, DidOpenTextDocument, Notification as _, PublishDiagnostics};
use lsp_types::request::{CodeActionRequest, Completion, GotoDefinition, HoverRequest, Request as _};
use lsp_types::{
    CodeAction, CodeActionKind, CodeActionOrCommand, CodeActionParams, CodeActionProviderCapability, CompletionItem,
    CompletionItemKind, CompletionOptions, CompletionParams, Diagnostic, DiagnosticSeverity,
    DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams, GotoDefinitionParams,
    GotoDefinitionResponse, Hover, HoverContents, HoverParams, HoverProviderCapability, Location, MarkupContent,
    MarkupKind, NumberOrString, OneOf, Position, PublishDiagnosticsParams, Range, ServerCapabilities,
    TextDocumentSyncCapability, TextDocumentSyncKind, TextEdit, Url, WorkspaceEdit,
};

use crate::check::{check_file, parse_records, utf16, Finding};
use crate::schema::{FieldLayout, FileType, Schema};

pub fn run(schema: &Schema) -> Result<(), Box<dyn Error + Sync + Send>> {
    let (connection, io_threads) = Connection::stdio();
    let capabilities = ServerCapabilities {
        text_document_sync: Some(TextDocumentSyncCapability::Kind(TextDocumentSyncKind::FULL)),
        completion_provider: Some(CompletionOptions {
            trigger_characters: Some(vec![":".into(), " ".into(), "*".into()]),
            ..Default::default()
        }),
        hover_provider: Some(HoverProviderCapability::Simple(true)),
        definition_provider: Some(OneOf::Left(true)),
        code_action_provider: Some(CodeActionProviderCapability::Simple(true)),
        ..Default::default()
    };
    connection.initialize(serde_json::to_value(capabilities)?)?;
    let mut docs: HashMap<Url, String> = HashMap::new();
    for message in &connection.receiver {
        match message {
            Message::Request(request) => {
                if connection.handle_shutdown(&request)? {
                    break;
                }
                let response = answer(schema, &docs, request);
                connection.sender.send(Message::Response(response))?;
            }
            Message::Notification(notification) => {
                if let Some(uri) = apply(&mut docs, notification) {
                    let diagnostics = docs.get(&uri).map(|text| diagnostics(schema, &uri, text)).unwrap_or_default();
                    let params = PublishDiagnosticsParams { uri, diagnostics, version: None };
                    connection.sender.send(Message::Notification(Notification::new(PublishDiagnostics::METHOD.into(), params)))?;
                }
            }
            Message::Response(_) => {}
        }
    }
    drop(connection);
    io_threads.join()?;
    Ok(())
}

/// Updates the open documents and returns the one whose diagnostics must be sent again.
fn apply(docs: &mut HashMap<Url, String>, notification: Notification) -> Option<Url> {
    match notification.method.as_str() {
        DidOpenTextDocument::METHOD => {
            let params: DidOpenTextDocumentParams = serde_json::from_value(notification.params).ok()?;
            docs.insert(params.text_document.uri.clone(), params.text_document.text);
            Some(params.text_document.uri)
        }
        DidChangeTextDocument::METHOD => {
            let params: DidChangeTextDocumentParams = serde_json::from_value(notification.params).ok()?;
            let text = params.content_changes.into_iter().last()?.text;
            docs.insert(params.text_document.uri.clone(), text);
            Some(params.text_document.uri)
        }
        DidCloseTextDocument::METHOD => {
            let params: DidCloseTextDocumentParams = serde_json::from_value(notification.params).ok()?;
            docs.remove(&params.text_document.uri);
            Some(params.text_document.uri)
        }
        _ => None,
    }
}

fn answer(schema: &Schema, docs: &HashMap<Url, String>, request: Request) -> Response {
    let id = request.id.clone();
    let result = match request.method.as_str() {
        Completion::METHOD => serde_json::from_value::<CompletionParams>(request.params).ok().map(|p| {
            let position = p.text_document_position;
            serde_json::to_value(complete(schema, docs, &position.text_document.uri, position.position))
        }),
        HoverRequest::METHOD => serde_json::from_value::<HoverParams>(request.params).ok().map(|p| {
            let position = p.text_document_position_params;
            serde_json::to_value(hover(schema, docs, &position.text_document.uri, position.position))
        }),
        GotoDefinition::METHOD => serde_json::from_value::<GotoDefinitionParams>(request.params).ok().map(|p| {
            let position = p.text_document_position_params;
            serde_json::to_value(definition(schema, docs, &position.text_document.uri, position.position))
        }),
        CodeActionRequest::METHOD => serde_json::from_value::<CodeActionParams>(request.params)
            .ok()
            .map(|p| serde_json::to_value(code_actions(schema, docs, &p.text_document.uri, p.range))),
        _ => None,
    };
    match result {
        Some(Ok(value)) => Response::new_ok(id, value),
        _ => Response::new_ok(id, serde_json::Value::Null),
    }
}

/// The open file as a corpus file: its notes dir, its path inside it, and its row.
fn corpus_file<'a>(schema: &'a Schema, uri: &Url) -> Option<(PathBuf, String, &'a FileType)> {
    let path = uri.to_file_path().ok()?;
    let (root, rel) = schema.locate(&path)?;
    let file_type = schema.match_file(&rel)?.file_type;
    Some((root, rel, file_type))
}

fn findings(schema: &Schema, uri: &Url, text: &str) -> Vec<Finding> {
    corpus_file(schema, uri).map(|(root, rel, _)| check_file(schema, &root, &rel, text)).unwrap_or_default()
}

fn diagnostics(schema: &Schema, uri: &Url, text: &str) -> Vec<Diagnostic> {
    findings(schema, uri, text)
        .into_iter()
        .map(|f| Diagnostic {
            range: range(f.line, f.start, f.end),
            severity: Some(DiagnosticSeverity::ERROR),
            code: Some(NumberOrString::String(f.check.into())),
            source: Some("wm-lsp".into()),
            message: f.message,
            ..Default::default()
        })
        .collect()
}

fn code_actions(schema: &Schema, docs: &HashMap<Url, String>, uri: &Url, wanted: Range) -> Vec<CodeActionOrCommand> {
    let Some(text) = docs.get(uri) else { return Vec::new() };
    findings(schema, uri, text)
        .into_iter()
        .filter(|f| f.line >= wanted.start.line && f.line <= wanted.end.line)
        .flat_map(|f| f.fixes)
        .map(|fix| {
            let edit = TextEdit { range: range(fix.line, fix.start, fix.end), new_text: fix.new_text };
            CodeActionOrCommand::CodeAction(CodeAction {
                title: fix.title,
                kind: Some(CodeActionKind::QUICKFIX),
                edit: Some(WorkspaceEdit { changes: Some(HashMap::from([(uri.clone(), vec![edit])])), ..Default::default() }),
                ..Default::default()
            })
        })
        .collect()
}

/// `None` when the cursor is not on a field line: outside the header, or outside an entry.
fn cursor(text: &str, layout: FieldLayout, position: Position) -> Option<(&str, &str)> {
    let line = text.lines().nth(position.line as usize).unwrap_or("");
    let in_fields = match layout {
        FieldLayout::None => false,
        FieldLayout::Entry => line.starts_with(layout.line_prefix()) || line == "-" || line == "- " || line.is_empty(),
        FieldLayout::Frontmatter => {
            let header_end = text.lines().skip(1).position(|l| l.trim_end() == "---").map(|i| i as u32 + 1);
            text.starts_with("---") && position.line > 0 && header_end.is_none_or(|end| position.line < end)
        }
    };
    in_fields.then(|| (line, &line[..byte_at(line, position.character)]))
}

fn complete(schema: &Schema, docs: &HashMap<Url, String>, uri: &Url, position: Position) -> Vec<CompletionItem> {
    let Some((_, _, file_type)) = corpus_file(schema, uri) else { return Vec::new() };
    let Some(text) = docs.get(uri) else { return Vec::new() };
    let Some((_, before)) = cursor(text, file_type.fields, position) else { return Vec::new() };
    let layout = file_type.fields;
    let key_part = before.trim_start_matches(['-', ' ', '*']);
    if let Some((key, _)) = key_part.split_once(layout.separator()) {
        let Some(row) = schema.field(file_type, key.trim()) else { return Vec::new() };
        return row
            .values
            .iter()
            .map(|value| CompletionItem { label: value.clone(), kind: Some(CompletionItemKind::ENUM_MEMBER), detail: Some(row.key.clone()), ..Default::default() })
            .collect();
    }
    let present: Vec<String> = parse_records(file_type.fields, text)
        .unwrap_or_default()
        .into_iter()
        .flat_map(|record| record.fields.into_iter().map(|field| field.key))
        .collect();
    schema
        .fields_of(file_type)
        .filter(|row| file_type.fields == FieldLayout::Entry || !present.contains(&row.key))
        .map(|row| {
            let insert = match file_type.fields {
                FieldLayout::Entry if before.contains("**") => format!("{}{} ", row.key, layout.separator()),
                _ => format!("{}{}{} ", layout.line_prefix(), row.key, layout.separator()),
            };
            CompletionItem {
                label: row.key.clone(),
                kind: Some(CompletionItemKind::FIELD),
                detail: Some(if row.required { "required".into() } else { "optional".into() }),
                documentation: Some(lsp_types::Documentation::String(row.doc.clone())),
                insert_text: Some(insert),
                ..Default::default()
            }
        })
        .collect()
}

fn hover(schema: &Schema, docs: &HashMap<Url, String>, uri: &Url, position: Position) -> Option<Hover> {
    let (_, _, file_type) = corpus_file(schema, uri)?;
    let (line, _) = cursor(docs.get(uri)?, file_type.fields, position)?;
    let layout = file_type.fields;
    let key = line.trim_start_matches(layout.line_prefix()).split_once(layout.separator())?.0.trim();
    let row = schema.field(file_type, key)?;
    let values = if row.values.is_empty() { String::new() } else { format!("\n\nAllowed: `{}`", row.values.join("` · `")) };
    Some(Hover {
        contents: HoverContents::Markup(MarkupContent { kind: MarkupKind::Markdown, value: format!("**{}** — {}{values}", row.key, row.doc) }),
        range: None,
    })
}

/// Jumps from a `TODO-N` under the cursor to the human half of that TODO.
fn definition(schema: &Schema, docs: &HashMap<Url, String>, uri: &Url, position: Position) -> Option<GotoDefinitionResponse> {
    let line = docs.get(uri)?.lines().nth(position.line as usize)?;
    let at = byte_at(line, position.character);
    let is_id = |c: char| c.is_ascii_alphanumeric() || c == '-';
    let start = line[..at].rfind(|c: char| !is_id(c)).map_or(0, |i| i + 1);
    let end = line[at..].find(|c: char| !is_id(c)).map_or(line.len(), |i| at + i);
    let (root, _) = schema.locate(&uri.to_file_path().ok()?)?;
    let target = Url::from_file_path(schema.todo_path(&root, &line[start..end])?).ok()?;
    Some(GotoDefinitionResponse::Scalar(Location { uri: target, range: range(0, 0, 0) }))
}

fn range(line: u32, start: u32, end: u32) -> Range {
    Range { start: Position { line, character: start }, end: Position { line, character: end } }
}

/// The byte offset of a UTF-16 column, clamped to the line.
fn byte_at(line: &str, column: u32) -> usize {
    line.char_indices().map(|(i, _)| i).chain([line.len()]).find(|&i| utf16(&line[..i]) >= column).unwrap_or(line.len())
}
