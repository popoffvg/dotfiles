//! The lines a comment covers, and the one text form every reader of them shares.
//!
//! A comment written over a selection covers the lines the selection touches, so the
//! store, the input file header, the export and the `comment` subcommand all have to name
//! a pair of lines rather than one. They name it the same way, from here: `12` for a
//! single line, `12-18` for a span. Lines are 1-based, as everywhere outside the wire.

/// Read `12` or `12-18`. `None` when the text is neither, when a line is 0, or when the
/// span runs backwards — a caller that cannot say which lines it means is a caller with
/// nothing to comment on.
pub fn parse(text: &str) -> Option<(usize, usize)> {
    let (start, end) = match text.split_once('-') {
        Some((start, end)) => (start, Some(end)),
        None => (text, None),
    };
    let line: usize = start.trim().parse().ok()?;
    let end_line: usize = match end {
        Some(end) => end.trim().parse().ok()?,
        None => line,
    };
    if line == 0 || end_line < line {
        return None;
    }
    Some((line, end_line))
}

/// `12` or `12-18` — what `parse` reads back.
pub fn label(line: usize, end_line: usize) -> String {
    if end_line > line {
        format!("{line}-{end_line}")
    } else {
        format!("{line}")
    }
}

/// `line 12` or `lines 12-18`, the export heading.
pub fn phrase(line: usize, end_line: usize) -> String {
    if end_line > line {
        format!("lines {line}-{end_line}")
    } else {
        format!("line {line}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_one_line_and_a_span() {
        assert_eq!(parse("12"), Some((12, 12)));
        assert_eq!(parse("12-18"), Some((12, 18)));
        assert_eq!(parse(" 12 - 18 "), Some((12, 18)));
        assert_eq!(parse("12-12"), Some((12, 12)));
    }

    #[test]
    fn refuses_what_names_no_lines() {
        for text in ["", "x", "0", "0-3", "18-12", "12-", "-12", "12-x"] {
            assert_eq!(parse(text), None, "{text} names no lines");
        }
    }

    #[test]
    fn every_form_round_trips_through_its_label() {
        for (line, end_line) in [(12, 12), (12, 18)] {
            assert_eq!(parse(&label(line, end_line)), Some((line, end_line)));
        }
        assert_eq!(label(12, 12), "12");
        assert_eq!(label(12, 18), "12-18");
    }

    #[test]
    fn the_export_reads_as_prose() {
        assert_eq!(phrase(12, 12), "line 12");
        assert_eq!(phrase(12, 18), "lines 12-18");
    }
}
