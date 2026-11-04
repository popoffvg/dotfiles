//! Move a thread from its line in the PR head commit to its line in the current text.

use similar::{DiffTag, TextDiff};

use crate::review::Thread;

/// 0-based lines in the current text.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Span {
    pub start: u32,
    pub end: u32,
    /// A commented line changed after the head commit, so the span is the nearest guess.
    pub moved: bool,
}

/// The span of an inline thread. With no head text (the head commit is not fetched), the
/// head lines are taken as they are.
pub fn locate(thread: &Thread, head: Option<&str>, current: &str) -> Option<Span> {
    if !thread.is_inline() {
        return None;
    }
    let end_line = thread.line?;
    let start_line = thread.start_line.unwrap_or(end_line);
    let last = current.lines().count().saturating_sub(1) as u32;
    let (start, start_moved) = place(head, current, start_line - 1);
    let (end, end_moved) = place(head, current, end_line - 1);
    Some(Span {
        start: start.min(end).min(last),
        end: end.min(last),
        moved: start_moved || end_moved,
    })
}

fn place(head: Option<&str>, current: &str, line: u32) -> (u32, bool) {
    let Some(head) = head else {
        return (line, false);
    };
    let diff = TextDiff::from_lines(head, current);
    let line = line as usize;
    for op in diff.ops() {
        let (tag, old, new) = op.as_tag_tuple();
        if !old.contains(&line) {
            continue;
        }
        let offset = line - old.start;
        if tag == DiffTag::Equal {
            return ((new.start + offset) as u32, false);
        }
        return ((new.start + offset.min(new.len().saturating_sub(1))) as u32, true);
    }
    (current.lines().count() as u32, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn thread(start: Option<u32>, line: u32) -> Thread {
        Thread {
            path: "a.go".into(),
            start_line: start,
            line: Some(line),
            side: "RIGHT".into(),
            resolved: false,
            outdated: false,
            comments: Vec::new(),
        }
    }

    #[test]
    fn a_line_moves_down_by_the_lines_added_above_it() {
        let head = "a\nb\nc\n";
        let current = "new\na\nb\nc\n";
        assert_eq!(
            locate(&thread(None, 3), Some(head), current),
            Some(Span { start: 3, end: 3, moved: false })
        );
    }

    #[test]
    fn a_changed_line_is_placed_on_its_replacement_and_marked_moved() {
        let head = "a\nb\nc\n";
        let current = "a\nB\nc\n";
        assert_eq!(
            locate(&thread(Some(1), 2), Some(head), current),
            Some(Span { start: 0, end: 1, moved: true })
        );
    }

    #[test]
    fn with_no_head_text_the_head_line_is_kept() {
        assert_eq!(
            locate(&thread(None, 2), None, "a\nb\nc\n"),
            Some(Span { start: 1, end: 1, moved: false })
        );
    }

    #[test]
    fn a_resolved_thread_has_no_span() {
        let mut resolved = thread(None, 1);
        resolved.resolved = true;
        assert_eq!(locate(&resolved, None, "a\n"), None);
    }
}
