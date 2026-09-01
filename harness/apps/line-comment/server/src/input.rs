//! The input file: where the operator types a comment.
//!
//! A code action targets a line by writing a header into a file of its own — one per code
//! action, named and swept by `scratch`. The operator types the body under it and saves.
//! The server learns of the save through a watch it registered on the whole family of
//! input files, so the file needs no editor support and no open buffer.

use crate::span;

/// `<!-- line-comment: docs/spec.md:12 -->`, or `docs/spec.md:12-18` over a selection.
const MARKER: &str = "<!-- line-comment: ";
const MARKER_END: &str = " -->";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub file: String,
    /// 1-based, as everywhere else in the store.
    pub line: usize,
    /// Last line covered. Equal to `line` for a comment on that line alone.
    pub end_line: usize,
}

/// The file the operator is handed: the target, then the body to work on. `body` is the
/// text of the comment already stored on that line, so an edit starts from what it says
/// now instead of from an empty file; it is empty for a line with no comment yet.
pub fn render(target: &Target, body: &str) -> String {
    let tail = if body.is_empty() {
        String::new()
    } else {
        format!("{body}\n")
    };
    format!(
        "{MARKER}{}:{}{MARKER_END}\n\n{tail}",
        target.file,
        span::label(target.line, target.end_line)
    )
}

/// Read back the target and the typed body. `None` when there is no header,
/// and an empty body means the operator saved without writing anything.
pub fn parse(text: &str) -> Option<(Target, String)> {
    let mut lines = text.lines();
    let header = lines.find(|line| line.trim_start().starts_with(MARKER))?;
    let inside = header
        .trim()
        .strip_prefix(MARKER)?
        .strip_suffix(MARKER_END)?
        .trim();
    let (file, lines_named) = inside.rsplit_once(':')?;
    let (line, end_line) = span::parse(lines_named.trim())?;
    let target = Target {
        file: file.trim().to_string(),
        line,
        end_line,
    };

    let body: Vec<&str> = lines.collect();
    Some((target, body.join("\n").trim().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target(line: usize, end_line: usize) -> Target {
        Target {
            file: "docs/spec.md".to_string(),
            line,
            end_line,
        }
    }

    #[test]
    fn round_trips_a_target() {
        let target = target(12, 12);
        let (parsed, body) = parse(&render(&target, "")).unwrap();
        assert_eq!(parsed, target);
        assert_eq!(body, "");
    }

    #[test]
    fn round_trips_a_selection() {
        let target = target(12, 18);
        let rendered = render(&target, "");
        assert!(rendered.starts_with("<!-- line-comment: docs/spec.md:12-18 -->"));
        assert_eq!(parse(&rendered).unwrap().0, target);
    }

    #[test]
    fn round_trips_a_body_already_stored() {
        let target = target(12, 12);
        let stored = "first line\n\nsecond line";
        let (parsed, body) = parse(&render(&target, stored)).unwrap();
        assert_eq!(parsed, target);
        assert_eq!(body, stored);
    }

    #[test]
    fn reads_a_multi_line_body() {
        let text = "<!-- line-comment: a/b.md:3 -->\n\nfirst line\n\nsecond line\n";
        let (target, body) = parse(text).unwrap();
        assert_eq!(target.file, "a/b.md");
        assert_eq!(target.line, 3);
        assert_eq!(target.end_line, 3);
        assert_eq!(body, "first line\n\nsecond line");
    }

    #[test]
    fn a_path_with_colons_keeps_its_line_number() {
        let (target, _) = parse("<!-- line-comment: weird:name.md:7 -->\ntext\n").unwrap();
        assert_eq!(target.file, "weird:name.md");
        assert_eq!(target.line, 7);
    }

    #[test]
    fn no_header_is_no_target() {
        assert!(parse("just prose\n").is_none());
        assert!(parse("").is_none());
    }
}
