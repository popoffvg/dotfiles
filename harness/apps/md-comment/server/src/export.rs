//! The export: lumen annotation format, byte for byte.

use crate::store::{Author, Store};

pub const HEADER: &str = "# line comments";

pub fn render(store: &Store) -> String {
    let mut out = String::from(HEADER);
    out.push_str("\n\n");

    let mut first = true;
    for (file, comments) in &store.files {
        for comment in comments {
            if !first {
                out.push_str("---\n\n");
            }
            first = false;
            let orphaned = if comment.orphaned { " (orphaned)" } else { "" };
            // Claude reads this file back. Without the author on the heading it would take
            // its own comments for instructions and act on them.
            let author = match comment.author {
                Author::Agent => " (from Claude)",
                Author::Human => "",
            };
            out.push_str(&format!(
                "**{}** line {} (RIGHT){}{}\n\n",
                file, comment.line, orphaned, author
            ));
            out.push_str(&comment.text);
            out.push_str("\n\n");
        }
    }

    let trimmed = out.trim_end();
    format!("{trimmed}\n")
}
