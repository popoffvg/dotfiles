use serde_json::{json, Value};

use crate::hunks::{hunk_at, Hunk};
use crate::store::Store;

pub const TOGGLE_HUNK: &str = "review-mark.toggle-hunk";
pub const TOGGLE_FILE: &str = "review-mark.toggle-file";

const REVIEWED: &str = "✅";
const NOT_REVIEWED: &str = "⬜";

/// The review state of one open buffer, rendered as code lenses, outline symbols,
/// and code actions. `path` is the store key of the file.
pub struct FileView<'a> {
    pub uri: &'a str,
    pub path: &'a str,
    pub line_count: u32,
    pub hunks: &'a [Hunk],
    pub store: &'a Store,
}

impl FileView<'_> {
    /// One lens on line 0 for the file, and one lens on the first line of each hunk.
    pub fn lenses(&self) -> Vec<Value> {
        if self.hunks.is_empty() {
            return Vec::new();
        }
        let file = lens(0, self.file_title(), TOGGLE_FILE, json!([self.uri]));
        let hunks = self.hunks.iter().map(|hunk| {
            let line = self.clamp(hunk.start);
            let title = format!("{} · file {}", self.hunk_title(hunk), self.progress_text());
            lens(line, title, TOGGLE_HUNK, json!([self.uri, line]))
        });
        std::iter::once(file).chain(hunks).collect()
    }

    /// One file symbol over the whole buffer, with one child per hunk.
    pub fn symbols(&self) -> Vec<Value> {
        if self.hunks.is_empty() {
            return Vec::new();
        }
        let children: Vec<Value> = self
            .hunks
            .iter()
            .map(|hunk| {
                let start = self.clamp(hunk.start);
                let end = self.clamp(hunk.start + hunk.len.max(1) - 1);
                symbol(self.hunk_title(hunk), 24, start, end, Vec::new())
            })
            .collect();
        vec![symbol(self.file_title(), 1, 0, self.clamp(self.line_count), children)]
    }

    pub fn actions(&self, line: u32) -> Vec<Value> {
        if self.hunks.is_empty() {
            return Vec::new();
        }
        let (done, total) = self.store.progress(self.path, self.hunks);
        let file_verb = if done == total { "unmark" } else { "mark" };
        let file = action(format!("review: {file_verb} file reviewed"), TOGGLE_FILE, json!([self.uri]));
        let hunk = hunk_at(self.hunks, line).map(|hunk| {
            let verb = if self.store.is_reviewed(self.path, hunk) { "unmark" } else { "mark" };
            action(format!("review: {verb} hunk reviewed"), TOGGLE_HUNK, json!([self.uri, line]))
        });
        hunk.into_iter().chain([file]).collect()
    }

    fn file_title(&self) -> String {
        let (done, total) = self.store.progress(self.path, self.hunks);
        let mark = if done == total { REVIEWED } else { NOT_REVIEWED };
        format!("{mark} file reviewed {done}/{total}")
    }

    fn hunk_title(&self, hunk: &Hunk) -> String {
        match self.store.is_reviewed(self.path, hunk) {
            true => format!("{REVIEWED} hunk reviewed"),
            false => format!("{NOT_REVIEWED} hunk not reviewed"),
        }
    }

    fn progress_text(&self) -> String {
        let (done, total) = self.store.progress(self.path, self.hunks);
        format!("{done}/{total}")
    }

    /// A deletion at the end of the buffer starts past the last line; show it on the last line.
    fn clamp(&self, line: u32) -> u32 {
        line.min(self.line_count.saturating_sub(1))
    }
}

fn range(start: u32, end: u32) -> Value {
    json!({ "start": { "line": start, "character": 0 }, "end": { "line": end, "character": 0 } })
}

fn lens(line: u32, title: String, command: &str, arguments: Value) -> Value {
    json!({
        "range": range(line, line),
        "command": { "title": title, "command": command, "arguments": arguments }
    })
}

fn symbol(name: String, kind: u32, start: u32, end: u32, children: Vec<Value>) -> Value {
    json!({
        "name": name,
        "kind": kind,
        "range": range(start, end),
        "selectionRange": range(start, start),
        "children": children
    })
}

fn action(title: String, command: &str, arguments: Value) -> Value {
    json!({
        "title": title,
        "kind": "refactor",
        "command": { "title": title, "command": command, "arguments": arguments }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hunks::hunks;

    #[test]
    fn lenses_show_file_progress_and_hunk_state() {
        let found = hunks("a\nb\nc\n", "A\nb\nC\n");
        let mut store = Store::default();
        store.toggle_hunk("f", &found[0]);
        let view = FileView { uri: "file:///r/f", path: "f", line_count: 3, hunks: &found, store: &store };
        let titles: Vec<String> = view
            .lenses()
            .iter()
            .map(|lens| lens["command"]["title"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(
            titles,
            vec!["⬜ file reviewed 1/2", "✅ hunk reviewed · file 1/2", "⬜ hunk not reviewed · file 1/2"]
        );
    }

    #[test]
    fn action_outside_a_hunk_offers_only_the_file() {
        let found = hunks("a\nb\nc\n", "A\nb\nc\n");
        let store = Store::default();
        let view = FileView { uri: "u", path: "f", line_count: 3, hunks: &found, store: &store };
        let titles: Vec<Value> = view.actions(2).iter().map(|action| action["title"].clone()).collect();
        assert_eq!(titles, vec![json!("review: mark file reviewed")]);
        assert_eq!(view.actions(0).len(), 2);
    }

    #[test]
    fn unchanged_file_shows_nothing() {
        let store = Store::default();
        let view = FileView { uri: "u", path: "f", line_count: 1, hunks: &[], store: &store };
        assert!(view.lenses().is_empty() && view.symbols().is_empty() && view.actions(0).is_empty());
    }
}
