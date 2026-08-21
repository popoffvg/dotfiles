//! The input file: where the operator types a comment.
//!
//! A code action targets a line by writing a header into a file of its own — one per code
//! action, named and swept by `scratch`. The operator types the body under it and saves.
//! The server learns of the save through a watch it registered on the whole family of
//! input files, so the file needs no editor support and no open buffer.

/// `<!-- md-comment: docs/spec.md:12 -->`
const MARKER: &str = "<!-- md-comment: ";
const MARKER_END: &str = " -->";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub file: String,
    /// 1-based, as everywhere else in the store.
    pub line: usize,
}

/// The file the operator is handed: the target, then room to type.
pub fn render(target: &Target) -> String {
    format!("{MARKER}{}:{}{MARKER_END}\n\n", target.file, target.line)
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
    let (file, line) = inside.rsplit_once(':')?;
    let target = Target {
        file: file.trim().to_string(),
        line: line.trim().parse().ok()?,
    };

    let body: Vec<&str> = lines.collect();
    Some((target, body.join("\n").trim().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_a_target() {
        let target = Target {
            file: "docs/spec.md".to_string(),
            line: 12,
        };
        let (parsed, body) = parse(&render(&target)).unwrap();
        assert_eq!(parsed, target);
        assert_eq!(body, "");
    }

    #[test]
    fn reads_a_multi_line_body() {
        let text = "<!-- md-comment: a/b.md:3 -->\n\nfirst line\n\nsecond line\n";
        let (target, body) = parse(text).unwrap();
        assert_eq!(target.file, "a/b.md");
        assert_eq!(target.line, 3);
        assert_eq!(body, "first line\n\nsecond line");
    }

    #[test]
    fn a_path_with_colons_keeps_its_line_number() {
        let (target, _) = parse("<!-- md-comment: weird:name.md:7 -->\ntext\n").unwrap();
        assert_eq!(target.file, "weird:name.md");
        assert_eq!(target.line, 7);
    }

    #[test]
    fn no_header_is_no_target() {
        assert!(parse("just prose\n").is_none());
        assert!(parse("").is_none());
    }
}
