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

/// `<!-- line-comment-commit: 9f2b1c4e7a05 -->`, on a line of its own under the header.
/// Written only by a hand-over that knows the revision the line was read on; the comment
/// then carries that revision in its text. A line of its own keeps the target header one
/// shape, so nothing that reads it has to know about revisions.
const COMMIT_MARKER: &str = "<!-- line-comment-commit: ";

/// Opens the block quoting the lines commented on.
const QUOTE_OPEN: &str = "<!-- commenting on:";
const QUOTE_CLOSE: &str = "-->";
/// Lines of the target quoted before the quote is cut short. A long selection would
/// otherwise push what the operator types off the screen.
const QUOTE_LIMIT: usize = 10;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub file: String,
    /// 1-based, as everywhere else in the store.
    pub line: usize,
    /// Last line covered. Equal to `line` for a comment on that line alone.
    pub end_line: usize,
    /// The revision the line was read on, when the hand-over knew it.
    pub commit: Option<String>,
}

/// The file the operator is handed: the target, the lines it aims at, then the body to
/// work on.
///
/// `quoted` is the text of those lines as the file reads now — the selection, or the one
/// line the cursor stood on. It sits in a comment block the parser drops again, so the
/// operator reads what the comment is about without scrolling back and types under it.
/// `body` is the text of the comment already stored there, so an edit starts from what it
/// says now instead of from an empty file; it is empty for a line with no comment yet.
///
/// `note` is what the hand-over could not settle by itself — the paths a target named from
/// outside the editor also matches. It rides inside the same dropped block, so the operator
/// reads it, corrects the header if the guess was wrong, and saves either way.
pub fn render(target: &Target, body: &str, quoted: &[&str], note: &[String]) -> String {
    let tail = if body.is_empty() {
        String::new()
    } else {
        format!("{body}\n")
    };
    let read_on = match &target.commit {
        Some(commit) => format!("{COMMIT_MARKER}{commit}{MARKER_END}\n"),
        None => String::new(),
    };
    format!(
        "{MARKER}{}:{}{MARKER_END}\n{read_on}{}\n{tail}",
        target.file,
        span::label(target.line, target.end_line),
        quote(quoted, note)
    )
}

/// The quoted lines as a comment block, empty when there is nothing to quote.
///
/// A `-->` inside the text would close the block early and spill the rest into the body,
/// so it is broken up. The quote is a reminder, not the source of truth.
fn quote(quoted: &[&str], note: &[String]) -> String {
    let kept: Vec<String> = quoted
        .iter()
        .take(QUOTE_LIMIT)
        .map(|line| line.replace(QUOTE_CLOSE, "-- >"))
        .collect();
    if kept.is_empty() && note.is_empty() {
        return String::new();
    }
    let rest = quoted.len() - kept.len();
    let elision = if rest > 0 {
        format!("\n… {rest} more line{}", if rest == 1 { "" } else { "s" })
    } else {
        String::new()
    };
    let told = if note.is_empty() {
        String::new()
    } else {
        format!("\n--\n{}", note.join("\n"))
    };
    format!(
        "{QUOTE_OPEN}\n{}{elision}{told}\n{QUOTE_CLOSE}\n",
        kept.join("\n")
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
    let rest: Vec<&str> = lines.collect();
    let target = Target {
        file: file.trim().to_string(),
        line,
        end_line,
        commit: commit_of(&rest),
    };

    let body = without_quote(&rest).join("\n").trim().to_string();
    Some((target, body))
}

/// The revision the hand-over wrote under the header, when it wrote one.
fn commit_of(lines: &[&str]) -> Option<String> {
    let marked = lines
        .iter()
        .find(|line| line.trim_start().starts_with(COMMIT_MARKER))?;
    let commit = marked
        .trim()
        .strip_prefix(COMMIT_MARKER)?
        .strip_suffix(MARKER_END)?
        .trim();
    (!commit.is_empty()).then(|| commit.to_string())
}

/// Everything after the quoted lines. The quote is what the hand-over wrote, so it is
/// dropped whenever it stands first — leaving it in would store the file's own text as the
/// comment, and an operator who saved without typing would comment instead of cancelling.
/// A block the operator never closed is text they wrote, and stays.
fn without_quote<'a>(lines: &[&'a str]) -> Vec<&'a str> {
    let Some(mut start) = lines.iter().position(|line| !line.trim().is_empty()) else {
        return Vec::new();
    };
    // The revision line the hand-over wrote stands between the header and the quote, and
    // is no more part of the body than the header is.
    if lines[start].trim_start().starts_with(COMMIT_MARKER) {
        let Some(next) = lines[start + 1..]
            .iter()
            .position(|line| !line.trim().is_empty())
        else {
            return Vec::new();
        };
        start += 1 + next;
    }
    if !lines[start].trim_start().starts_with(QUOTE_OPEN) {
        return lines[start..].to_vec();
    }
    match lines[start..]
        .iter()
        .position(|line| line.trim_end().ends_with(QUOTE_CLOSE))
    {
        Some(offset) => lines[start + offset + 1..].to_vec(),
        None => lines[start..].to_vec(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target(line: usize, end_line: usize) -> Target {
        Target {
            file: "docs/spec.md".to_string(),
            line,
            end_line,
            commit: None,
        }
    }

    #[test]
    fn round_trips_a_target() {
        let target = target(12, 12);
        let (parsed, body) = parse(&render(&target, "", &[], &[])).unwrap();
        assert_eq!(parsed, target);
        assert_eq!(body, "");
    }

    #[test]
    fn round_trips_a_selection() {
        let target = target(12, 18);
        let rendered = render(&target, "", &[], &[]);
        assert!(rendered.starts_with("<!-- line-comment: docs/spec.md:12-18 -->"));
        assert_eq!(parse(&rendered).unwrap().0, target);
    }

    #[test]
    fn round_trips_a_body_already_stored() {
        let target = target(12, 12);
        let stored = "first line\n\nsecond line";
        let (parsed, body) = parse(&render(&target, stored, &[], &[])).unwrap();
        assert_eq!(parsed, target);
        assert_eq!(body, stored);
    }

    #[test]
    fn quotes_the_lines_commented_on_and_reads_them_back_out() {
        let rendered = render(&target(2, 3), "", &["b", "c"], &[]);
        assert_eq!(
            rendered,
            "<!-- line-comment: docs/spec.md:2-3 -->\n<!-- commenting on:\nb\nc\n-->\n\n"
        );
        // Saved untouched, the quote is not a comment: the pending comment is cancelled.
        let (parsed, body) = parse(&rendered).unwrap();
        assert_eq!(parsed, target(2, 3));
        assert_eq!(body, "");
    }

    #[test]
    fn the_body_typed_under_the_quote_is_the_comment() {
        let text = render(&target(2, 2), "", &["b"], &[]) + "needs a source\n";
        assert_eq!(parse(&text).unwrap().1, "needs a source");
    }

    #[test]
    fn a_stored_comment_sits_under_the_quote() {
        let rendered = render(&target(2, 2), "needs a source", &["b"], &[]);
        assert!(rendered.ends_with("-->\n\nneeds a source\n"), "{rendered}");
        assert_eq!(parse(&rendered).unwrap().1, "needs a source");
    }

    #[test]
    fn a_long_selection_is_cut_short() {
        let document: Vec<String> = (1..=13).map(|n| format!("line {n}")).collect();
        let quoted: Vec<&str> = document.iter().map(String::as_str).collect();
        let rendered = render(&target(1, 13), "", &quoted, &[]);
        assert!(
            rendered.contains("line 10\n… 3 more lines\n-->"),
            "{rendered}"
        );
        assert!(!rendered.contains("line 11"), "{rendered}");
        assert_eq!(parse(&rendered).unwrap().1, "");
    }

    #[test]
    fn a_closing_marker_in_the_quoted_text_cannot_end_the_block() {
        let rendered = render(&target(1, 1), "", &["<!-- html --> tail"], &[]);
        assert_eq!(parse(&rendered).unwrap().1, "");
    }

    #[test]
    fn text_the_operator_wrote_is_never_taken_for_the_quote() {
        let text = "<!-- line-comment: a/b.md:3 -->\n\n<!-- keep this note\nand this line\n";
        assert_eq!(parse(text).unwrap().1, "<!-- keep this note\nand this line");
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

    /// The revision the hand-over knew rides under the header and is no part of the body,
    /// so an untouched save still cancels and a typed one keeps only what was typed.
    #[test]
    fn the_revision_line_is_read_back_and_never_becomes_the_body() {
        let aimed = Target {
            file: "docs/spec.md".to_string(),
            line: 2,
            end_line: 2,
            commit: Some("9f2b1c4e7a05".to_string()),
        };
        let rendered = render(&aimed, "", &["b"], &[]);
        assert!(
            rendered.contains("<!-- line-comment-commit: 9f2b1c4e7a05 -->"),
            "{rendered}"
        );

        let (parsed, body) = parse(&rendered).unwrap();
        assert_eq!(parsed, aimed);
        assert_eq!(body, "");

        let typed = rendered + "needs a source\n";
        let (parsed, body) = parse(&typed).unwrap();
        assert_eq!(parsed.commit.as_deref(), Some("9f2b1c4e7a05"));
        assert_eq!(body, "needs a source");
    }

    #[test]
    fn no_header_is_no_target() {
        assert!(parse("just prose\n").is_none());
        assert!(parse("").is_none());
    }
}
