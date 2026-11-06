use std::path::Path;

use crate::check::{check_file, parse_records, todo_refs, Finding};
use crate::schema::{FieldLayout, Schema};

/// A notes dir is usable when it is a directory with a spec under any of its names.
pub fn is_usable(schema: &Schema, root: &Path) -> bool {
    let Some(spec) = schema.files.iter().find(|file_type| file_type.name == "spec") else { return false };
    spec.names.iter().any(|name| root.join(name).is_file())
}

/// Every corpus file the schema table knows, as paths inside the notes dir, sorted.
pub fn corpus_files(schema: &Schema, root: &Path) -> Vec<String> {
    let mut rels: Vec<String> = schema
        .folders()
        .into_iter()
        .flat_map(|sub| {
            std::fs::read_dir(root.join(&sub))
                .into_iter()
                .flatten()
                .flatten()
                .filter_map(move |entry| Some(format!("{sub}{}", entry.file_name().to_str()?)))
        })
        .filter(|rel| schema.match_file(rel).is_some())
        .collect();
    rels.sort();
    rels
}

pub fn lint(schema: &Schema, root: &Path) -> Vec<Finding> {
    corpus_files(schema, root)
        .iter()
        .flat_map(|rel| {
            let text = std::fs::read_to_string(root.join(rel)).unwrap_or_default();
            check_file(schema, root, rel, &text)
        })
        .collect()
}

pub struct TodoState {
    pub id: String,
    pub status: String,
    pub depends_on: Vec<String>,
    pub ready: bool,
}

/// Each human half with its status, and whether it can start: `todo` with every dependency done.
pub fn ledger(schema: &Schema, root: &Path) -> Vec<TodoState> {
    let header = |id: &str, key: &str| -> String {
        let text = schema.todo_path(root, id).and_then(|path| std::fs::read_to_string(path).ok()).unwrap_or_default();
        parse_records(FieldLayout::Frontmatter, &text)
            .and_then(|records| records.into_iter().next())
            .and_then(|record| record.fields.into_iter().find(|field| field.key == key))
            .map(|field| field.value)
            .unwrap_or_default()
    };
    let mut numbers: Vec<u32> = corpus_files(schema, root)
        .iter()
        .filter_map(|rel| {
            let matched = schema.match_file(rel)?;
            if matched.file_type.name == "todo" { matched.star.parse().ok() } else { None }
        })
        .collect();
    numbers.sort();
    numbers.dedup();
    numbers
        .into_iter()
        .filter_map(|number| schema.todo_id(&number.to_string()))
        .map(|id| {
            let status = header(&id, "status");
            let depends_on = todo_refs(&header(&id, "depends_on"));
            let ready = status == "todo" && depends_on.iter().all(|dep| header(dep, "status") == "done");
            TodoState { id, status, depends_on, ready }
        })
        .collect()
}
