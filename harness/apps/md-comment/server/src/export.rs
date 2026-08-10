//! The export: lumen annotation format, byte for byte.

use crate::store::Store;

pub const HEADER: &str = "# markdown comments";

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
            out.push_str(&format!(
                "**{}** line {} (RIGHT){}\n\n",
                file, comment.line, orphaned
            ));
            out.push_str(&comment.text);
            out.push_str("\n\n");
        }
    }

    let trimmed = out.trim_end();
    format!("{trimmed}\n")
}
