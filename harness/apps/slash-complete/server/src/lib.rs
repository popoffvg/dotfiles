//! The catalog of slash names that Claude Code offers, and the completion of a `/` token.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Skill,
    Command,
}

#[derive(Clone, Copy)]
enum Base {
    Project,
    Home,
}

struct Source {
    base: Base,
    dir: &'static str,
    kind: Kind,
    label: &'static str,
}

/// Claude Code reads these folders. A name found in an earlier row hides the same name in a later row.
const SOURCES: &[Source] = &[
    Source { base: Base::Project, dir: ".claude/skills", kind: Kind::Skill, label: "project skill" },
    Source { base: Base::Project, dir: ".claude/commands", kind: Kind::Command, label: "project command" },
    Source { base: Base::Project, dir: ".agents/skills", kind: Kind::Skill, label: "project agents skill" },
    Source { base: Base::Project, dir: ".agents/commands", kind: Kind::Command, label: "project agents command" },
    Source { base: Base::Project, dir: ".cursor/skills", kind: Kind::Skill, label: "project cursor skill" },
    Source { base: Base::Project, dir: ".cursor/commands", kind: Kind::Command, label: "project cursor command" },
    Source { base: Base::Home, dir: ".claude/skills", kind: Kind::Skill, label: "user skill" },
    Source { base: Base::Home, dir: ".claude/commands", kind: Kind::Command, label: "user command" },
    Source { base: Base::Home, dir: ".agents/skills", kind: Kind::Skill, label: "agents skill" },
    Source { base: Base::Home, dir: ".agents/commands", kind: Kind::Command, label: "agents command" },
    Source { base: Base::Home, dir: ".cursor/skills", kind: Kind::Skill, label: "cursor skill" },
    Source { base: Base::Home, dir: ".cursor/commands", kind: Kind::Command, label: "cursor command" },
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub kind: Kind,
    pub origin: String,
    pub description: String,
    pub argument_hint: String,
}

/// Every slash name visible from `project`, sorted by name.
pub fn catalog(home: &Path, project: Option<&Path>) -> Vec<Entry> {
    let mut found: BTreeMap<String, Entry> = BTreeMap::new();
    let mut keep = |entry: Entry| {
        found.entry(entry.name.clone()).or_insert(entry);
    };
    for source in SOURCES {
        let base = match source.base {
            Base::Home => home,
            Base::Project => match project {
                Some(path) => path,
                None => continue,
            },
        };
        for entry in scan(&base.join(source.dir), source.kind, "", source.label) {
            keep(entry);
        }
    }
    for plugin in enabled_plugins(home) {
        let origin = format!("plugin {}", plugin.name);
        let prefix = format!("{}:", plugin.name);
        for kind in [Kind::Skill, Kind::Command] {
            let dir = match kind {
                Kind::Skill => "skills",
                Kind::Command => "commands",
            };
            for entry in scan(&plugin.path.join(dir), kind, &prefix, &origin) {
                keep(entry);
            }
        }
    }
    found.into_values().collect()
}

fn scan(dir: &Path, kind: Kind, prefix: &str, origin: &str) -> Vec<Entry> {
    let mut entries = Vec::new();
    match kind {
        Kind::Skill => {
            for child in children(dir) {
                let file = child.join("SKILL.md");
                let Ok(text) = fs::read_to_string(&file) else { continue };
                let meta = Frontmatter::parse(&text);
                let stem = file_name(&child);
                entries.push(Entry {
                    name: format!("{prefix}{}", meta.get("name").unwrap_or(&stem)),
                    kind,
                    origin: origin.to_string(),
                    description: meta.get("description").cloned().unwrap_or_default(),
                    argument_hint: meta.get("argument-hint").cloned().unwrap_or_default(),
                });
            }
        }
        Kind::Command => {
            let mut stack = vec![dir.to_path_buf()];
            while let Some(current) = stack.pop() {
                for child in children_all(&current) {
                    if child.is_dir() {
                        stack.push(child);
                        continue;
                    }
                    if child.extension().and_then(|e| e.to_str()) != Some("md") {
                        continue;
                    }
                    let Ok(text) = fs::read_to_string(&child) else { continue };
                    let meta = Frontmatter::parse(&text);
                    let stem = child.file_stem().and_then(|s| s.to_str()).unwrap_or_default();
                    entries.push(Entry {
                        name: format!("{prefix}{stem}"),
                        kind,
                        origin: origin.to_string(),
                        description: meta
                            .get("description")
                            .cloned()
                            .unwrap_or_else(|| first_body_line(&text)),
                        argument_hint: meta.get("argument-hint").cloned().unwrap_or_default(),
                    });
                }
            }
        }
    }
    entries
}

fn children_all(dir: &Path) -> Vec<PathBuf> {
    let Ok(read) = fs::read_dir(dir) else { return Vec::new() };
    let mut paths: Vec<PathBuf> = read.filter_map(|e| e.ok()).map(|e| e.path()).collect();
    paths.sort();
    paths
}

fn children(dir: &Path) -> Vec<PathBuf> {
    children_all(dir).into_iter().filter(|p| p.is_dir()).collect()
}

fn file_name(path: &Path) -> String {
    path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_string()
}

struct Plugin {
    name: String,
    path: PathBuf,
}

/// Plugins that `~/.claude/settings.json` turns on, at the path `installed_plugins.json` gives.
fn enabled_plugins(home: &Path) -> Vec<Plugin> {
    let read = |path: PathBuf| -> Value {
        fs::read_to_string(path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(Value::Null)
    };
    let settings = read(home.join(".claude/settings.json"));
    let installed = read(home.join(".claude/plugins/installed_plugins.json"));
    let Some(enabled) = settings["enabledPlugins"].as_object() else { return Vec::new() };
    let mut plugins = Vec::new();
    for (key, on) in enabled {
        if on.as_bool() != Some(true) {
            continue;
        }
        let Some(install) = installed["plugins"][key]
            .as_array()
            .and_then(|installs| installs.first())
            .and_then(|install| install["installPath"].as_str())
        else {
            continue;
        };
        let path = PathBuf::from(install);
        let manifest = read(path.join(".claude-plugin/plugin.json"));
        let name = manifest["name"]
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| key.split('@').next().unwrap_or(key).to_string());
        plugins.push(Plugin { name, path });
    }
    plugins
}

/// The top-level scalar keys of a YAML frontmatter block. A folded or literal block becomes one line.
struct Frontmatter(BTreeMap<String, String>);

impl Frontmatter {
    fn parse(text: &str) -> Self {
        let mut fields = BTreeMap::new();
        let mut lines = text.lines();
        if lines.next().map(str::trim) != Some("---") {
            return Frontmatter(fields);
        }
        let mut current: Option<String> = None;
        for line in lines {
            if line.trim() == "---" {
                break;
            }
            let indented = line.starts_with(' ') || line.starts_with('\t');
            if indented {
                if let Some(key) = &current {
                    let value: &mut String = fields.entry(key.clone()).or_default();
                    if !value.is_empty() {
                        value.push(' ');
                    }
                    value.push_str(line.trim());
                }
                continue;
            }
            current = None;
            let Some((key, value)) = line.split_once(':') else { continue };
            let key = key.trim().to_string();
            let value = value.trim();
            if matches!(value, "" | ">" | "|" | ">-" | "|-") {
                current = Some(key.clone());
                fields.insert(key, String::new());
            } else {
                fields.insert(key, unquote(value).to_string());
            }
        }
        Frontmatter(fields)
    }

    fn get(&self, key: &str) -> Option<&String> {
        self.0.get(key).filter(|v| !v.is_empty())
    }
}

fn unquote(value: &str) -> &str {
    for quote in ['"', '\''] {
        if value.len() >= 2 && value.starts_with(quote) && value.ends_with(quote) {
            return &value[1..value.len() - 1];
        }
    }
    value
}

fn first_body_line(text: &str) -> String {
    let body = match text.strip_prefix("---") {
        Some(rest) => rest.split_once("\n---").map(|(_, b)| b).unwrap_or(""),
        None => text,
    };
    body.lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or_default()
        .trim_start_matches('#')
        .trim()
        .to_string()
}

/// The `/` token that ends at `character` (a UTF-16 offset) in `line`: its start as a UTF-16 offset.
/// The `/` must open the line or follow whitespace, so a path such as `a/b` is not a token.
pub fn slash_token_start(line: &str, character: u32) -> Option<u32> {
    let units: Vec<u16> = line.encode_utf16().collect();
    let end = (character as usize).min(units.len());
    let before = String::from_utf16_lossy(&units[..end]);
    let token_len = before
        .chars()
        .rev()
        .take_while(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | ':' | '.'))
        .map(char::len_utf16)
        .sum::<usize>();
    let slash = end.checked_sub(token_len + 1)?;
    if units[slash] != u16::from(b'/') {
        return None;
    }
    let opens = slash == 0 || String::from_utf16_lossy(&units[slash - 1..slash]).chars().all(char::is_whitespace);
    opens.then_some(slash as u32)
}

/// The LSP completion items for a `/` token on `line` from `start` to `character`.
pub fn completion_items(entries: &[Entry], line: u32, start: u32, character: u32) -> Value {
    let items: Vec<Value> = entries
        .iter()
        .map(|entry| {
            let text = format!("/{}", entry.name);
            let detail = if entry.argument_hint.is_empty() {
                entry.origin.clone()
            } else {
                format!("{} {}", entry.argument_hint, entry.origin)
            };
            json!({
                "label": text,
                "kind": match entry.kind { Kind::Skill => 9, Kind::Command => 14 },
                "labelDetails": { "description": detail },
                "detail": detail,
                "documentation": { "kind": "markdown", "value": entry.description },
                "filterText": text,
                "sortText": entry.name,
                "textEdit": {
                    "range": {
                        "start": { "line": line, "character": start },
                        "end": { "line": line, "character": character },
                    },
                    "newText": text,
                },
            })
        })
        .collect();
    json!({ "isIncomplete": false, "items": items })
}
