//! The export: lumen annotation format, byte for byte.

use crate::span;
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
                "**{}** {} (RIGHT){}{}\n\n",
                file,
                span::phrase(comment.line, comment.last_line()),
                orphaned,
                author
            ));
            out.push_str(&comment.text);
            out.push_str("\n\n");
        }
    }

    let trimmed = out.trim_end();
    format!("{trimmed}\n")
}

/// The file and the lines of a heading that `render` wrote: `**a.md** lines 3-5 (RIGHT)`.
pub fn read_heading(line: &str) -> Option<(&str, usize, usize)> {
    let (file, rest) = line.strip_prefix("**")?.split_once("** ")?;
    let lines = rest.split_whitespace().nth(1)?;
    let (start, end) = span::parse(lines)?;
    Some((file, start, end))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_back_the_heading_it_writes() {
        let heading = format!("**docs/a b.md** {} (RIGHT) (orphaned)", span::phrase(3, 5));
        assert_eq!(read_heading(&heading), Some(("docs/a b.md", 3, 5)));
        let heading = format!("**a.md** {} (RIGHT)", span::phrase(7, 7));
        assert_eq!(read_heading(&heading), Some(("a.md", 7, 7)));
    }

    #[test]
    fn reads_no_heading_from_a_comment_body() {
        for line in ["", "---", "check", "**bold** text", "**a.md**"] {
            assert_eq!(read_heading(line), None, "{line}");
        }
    }
}
