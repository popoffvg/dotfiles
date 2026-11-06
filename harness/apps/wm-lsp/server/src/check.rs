use std::path::Path;

use crate::schema::{Field, FieldKind, FieldLayout, Matched, Schema};

pub const CHECKS: &[(&str, &str)] = &[
    ("H1", "a file with a header starts with a `---` block"),
    ("H2", "every required field is present"),
    ("H3", "every field is a key the schema table lists"),
    ("H4", "every enum value is allowed; a progress value is `<done>/<total>`"),
    ("H5", "every `depends_on` entry names a TODO file that exists"),
    ("S1", "the sections of the file type are present, in order"),
    ("N1", "no file exists under both its old and its new name"),
];

pub struct Finding {
    pub file: String,
    pub line: u32,
    pub start: u32,
    pub end: u32,
    pub check: &'static str,
    pub message: String,
    pub fixes: Vec<Fix>,
}

/// One text edit on the line of its finding.
pub struct Fix {
    pub title: String,
    pub line: u32,
    pub start: u32,
    pub end: u32,
    pub new_text: String,
}

/// One `key: value` line of a header, or one `- **Key:** value` line of a glossary entry.
/// Columns are UTF-16 offsets, the unit LSP positions use.
pub struct FieldLine {
    pub key: String,
    pub value: String,
    pub line: u32,
    pub key_start: u32,
    pub key_end: u32,
    pub value_start: u32,
    pub value_end: u32,
}

/// The header of a spec or TODO file, or one glossary entry. `end_line` is where a missing
/// field is inserted.
pub struct Record {
    pub line: u32,
    pub end_line: u32,
    pub fields: Vec<FieldLine>,
}

/// `None` means the file type has a header and the file has none.
pub fn parse_records(layout: FieldLayout, text: &str) -> Option<Vec<Record>> {
    match layout {
        FieldLayout::None => Some(Vec::new()),
        FieldLayout::Frontmatter => parse_frontmatter(text).map(|record| vec![record]),
        FieldLayout::Entry => Some(parse_entries(text)),
    }
}

fn parse_frontmatter(text: &str) -> Option<Record> {
    let mut lines = text.lines().enumerate();
    if lines.next()?.1.trim_end() != "---" {
        return None;
    }
    let mut fields = Vec::new();
    for (index, line) in lines {
        if line.trim_end() == "---" {
            return Some(Record { line: 0, end_line: index as u32, fields });
        }
        fields.extend(parse_frontmatter_line(index as u32, line));
    }
    None
}

fn parse_frontmatter_line(line_no: u32, line: &str) -> Option<FieldLine> {
    let (key, rest) = line.split_once(':')?;
    let value_offset = key.len() + 1;
    let raw = rest.split(" #").next().unwrap_or("");
    let lead = raw.len() - raw.trim_start().len();
    Some(field_line(line_no, line, key.trim(), 0, raw.trim(), value_offset + lead))
}

fn parse_entries(text: &str) -> Vec<Record> {
    let mut records: Vec<Record> = Vec::new();
    for (index, line) in text.lines().enumerate() {
        let index = index as u32;
        if line.starts_with('#') {
            if let Some(last) = records.last_mut() {
                last.end_line = last.end_line.max(last.line + 1);
            }
            if line.starts_with("### ") {
                records.push(Record { line: index, end_line: index + 1, fields: Vec::new() });
            }
            continue;
        }
        let Some(record) = records.last_mut() else { continue };
        let layout = FieldLayout::Entry;
        let Some(rest) = line.strip_prefix(layout.line_prefix()) else { continue };
        let Some((key, value)) = rest.split_once(layout.separator()) else { continue };
        let value_offset = layout.line_prefix().len() + key.len() + layout.separator().len();
        let lead = value.len() - value.trim_start().len();
        record.fields.push(field_line(index, line, key, layout.line_prefix().len(), value.trim(), value_offset + lead));
        record.end_line = index + 1;
    }
    records
}

fn field_line(line_no: u32, line: &str, key: &str, key_offset: usize, value: &str, value_offset: usize) -> FieldLine {
    let key_start = utf16(&line[..key_offset]);
    let value_start = utf16(&line[..value_offset.min(line.len())]);
    FieldLine {
        key: key.to_string(),
        value: value.to_string(),
        line: line_no,
        key_start,
        key_end: key_start + utf16(key),
        value_start,
        value_end: value_start + utf16(value),
    }
}

pub fn utf16(text: &str) -> u32 {
    text.encode_utf16().count() as u32
}

/// Every finding of one file. `root` is the notes dir; other files are read from disk.
pub fn check_file(schema: &Schema, root: &Path, rel: &str, text: &str) -> Vec<Finding> {
    let Some(matched) = schema.match_file(rel) else { return Vec::new() };
    let mut findings = Vec::new();
    let new_finding = |line, start, end, check, message: String| Finding {
        file: rel.to_string(),
        line,
        start,
        end,
        check,
        message,
        fixes: Vec::new(),
    };

    check_names(&matched, root, &mut |message| findings.push(new_finding(0, 0, 0, "N1", message)));

    match parse_records(matched.file_type.fields, text) {
        None => findings.push(new_finding(0, 0, 0, "H1", "the file has no `---` header block".into())),
        Some(records) => {
            for record in &records {
                check_record(schema, &matched, root, rel, record, &mut findings);
            }
        }
    }
    check_sections(&matched.file_type.sections, text, &mut |line, message| {
        findings.push(new_finding(line, 0, 0, "S1", message))
    });
    findings
}

fn check_names(matched: &Matched, root: &Path, report: &mut dyn FnMut(String)) {
    for index in 0..matched.file_type.names.len() {
        let other = matched.file_type.path_for(index, &matched.star);
        if index != matched.index && root.join(&other).exists() {
            report(format!("`{other}` is the same file under another name; keep one"));
        }
    }
}

fn check_record(schema: &Schema, matched: &Matched, root: &Path, rel: &str, record: &Record, findings: &mut Vec<Finding>) {
    for field in &record.fields {
        let finding = |check, start, end, message: String, fixes| Finding {
            file: rel.to_string(),
            line: field.line,
            start,
            end,
            check,
            message,
            fixes,
        };
        let Some(row) = schema.field(matched.file_type, &field.key) else {
            findings.push(finding("H3", field.key_start, field.key_end, format!("`{}` is not a field of a {} file", field.key, matched.file_type.name), Vec::new()));
            continue;
        };
        findings.extend(check_value(schema, row, root, field).map(|(check, message)| {
            finding(check, field.value_start, field.value_end, message, value_fixes(row, field))
        }));
    }
    for row in schema.fields_of(matched.file_type).filter(|row| row.required) {
        if record.fields.iter().all(|field| field.key != row.key) {
            let layout = matched.file_type.fields;
            let new_text = format!("{}{}{} \n", layout.line_prefix(), row.key, layout.separator());
            let fix = Fix { title: format!("Add `{}`", row.key), line: record.end_line, start: 0, end: 0, new_text };
            findings.push(Finding {
                file: rel.to_string(),
                line: record.line,
                start: 0,
                end: 0,
                check: "H2",
                message: format!("the required field `{}` is missing", row.key),
                fixes: vec![fix],
            });
        }
    }
}

fn check_value(schema: &Schema, row: &Field, root: &Path, field: &FieldLine) -> Option<(&'static str, String)> {
    match row.kind {
        FieldKind::Text => None,
        FieldKind::Enum => (!row.values.contains(&field.value)).then(|| {
            ("H4", format!("`{}` is not allowed for `{}`; allowed: {}", field.value, row.key, row.values.join(", ")))
        }),
        FieldKind::Progress => {
            let valid = field.value.split_once('/').is_some_and(|(done, total)| {
                matches!((done.parse::<u32>(), total.parse::<u32>()), (Ok(d), Ok(t)) if d <= t)
            });
            (!valid).then(|| ("H4", format!("`{}` is not `<done>/<total>`", field.value)))
        }
        FieldKind::TodoRefs => {
            let missing: Vec<String> = todo_refs(&field.value)
                .into_iter()
                .filter(|id| schema.todo_path(root, id).is_none())
                .collect();
            (!missing.is_empty()).then(|| ("H5", format!("no TODO file for {}", missing.join(", "))))
        }
    }
}

fn value_fixes(row: &Field, field: &FieldLine) -> Vec<Fix> {
    row.values
        .iter()
        .map(|value| Fix {
            title: format!("Set `{}` to `{value}`", row.key),
            line: field.line,
            start: field.value_start,
            end: field.value_end,
            new_text: value.clone(),
        })
        .collect()
}

pub fn todo_refs(value: &str) -> Vec<String> {
    value
        .trim_matches(|c| c == '[' || c == ']')
        .split(',')
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(String::from)
        .collect()
}

fn check_sections(required: &[String], text: &str, report: &mut dyn FnMut(u32, String)) {
    let headings: Vec<(u32, &str)> = text
        .lines()
        .enumerate()
        .filter_map(|(index, line)| line.strip_prefix("## ").map(|title| (index as u32, title.trim())))
        .collect();
    let mut last_line = 0;
    for section in required {
        match headings.iter().find(|(_, title)| title == section) {
            None => report(0, format!("the section `## {section}` is missing")),
            Some(&(line, _)) if line < last_line => report(line, format!("`## {section}` must come after the sections above it in the schema order")),
            Some(&(line, _)) => last_line = line,
        }
    }
}
