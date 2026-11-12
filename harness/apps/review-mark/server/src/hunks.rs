use sha2::{Digest, Sha256};
use similar::{DiffOp, TextDiff};

/// A run of changed lines between the base text and the buffer text.
/// `start` and `len` count 0-based lines of the buffer; a pure deletion has `len` 0.
/// `id` hashes the removed and the added lines, so the id survives a line shift
/// and changes when the hunk text changes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hunk {
    pub id: String,
    pub start: u32,
    pub len: u32,
}

impl Hunk {
    pub fn covers(&self, line: u32) -> bool {
        line >= self.start && line < self.start + self.len.max(1)
    }
}

pub fn hunks(base: &str, buffer: &str) -> Vec<Hunk> {
    let diff = TextDiff::from_lines(base, buffer);
    let old: Vec<&str> = base.split_inclusive('\n').collect();
    let new: Vec<&str> = buffer.split_inclusive('\n').collect();
    let mut result = Vec::new();
    let mut open: Option<(usize, usize, usize, usize)> = None;
    for op in diff.ops() {
        if let DiffOp::Equal { .. } = op {
            result.extend(open.take().map(|run| hunk(&old, &new, run)));
            continue;
        }
        let (old_range, new_range) = (op.old_range(), op.new_range());
        let run = open.get_or_insert((old_range.start, old_range.start, new_range.start, new_range.start));
        run.1 = old_range.end;
        run.3 = new_range.end;
    }
    result.extend(open.map(|run| hunk(&old, &new, run)));
    result
}

fn hunk(old: &[&str], new: &[&str], (old_start, old_end, new_start, new_end): (usize, usize, usize, usize)) -> Hunk {
    let mut hasher = Sha256::new();
    old[old_start..old_end].iter().for_each(|line| hasher.update(format!("-{line}")));
    new[new_start..new_end].iter().for_each(|line| hasher.update(format!("+{line}")));
    let id = hasher.finalize().iter().take(8).map(|byte| format!("{byte:02x}")).collect();
    Hunk { id, start: new_start as u32, len: (new_end - new_start) as u32 }
}

pub fn hunk_at(hunks: &[Hunk], line: u32) -> Option<&Hunk> {
    hunks.iter().find(|hunk| hunk.covers(line))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adjacent_changes_form_one_hunk_and_equal_lines_split_hunks() {
        let found = hunks("a\nb\nc\nd\ne\n", "a\nB\nC\nd\ne\nf\n");
        let spans: Vec<(u32, u32)> = found.iter().map(|hunk| (hunk.start, hunk.len)).collect();
        assert_eq!(spans, vec![(1, 2), (5, 1)]);
    }

    #[test]
    fn hunk_id_survives_a_line_shift() {
        let before = hunks("x\ny\n", "x\nY\n");
        let after = hunks("w\nx\ny\n", "w\nx\nY\n");
        assert_eq!(before[0].id, after[0].id);
        assert_eq!(after[0].start, 2);
    }

    #[test]
    fn hunk_id_changes_with_the_hunk_text() {
        assert_ne!(hunks("x\n", "y\n")[0].id, hunks("x\n", "z\n")[0].id);
    }

    #[test]
    fn deletion_covers_the_line_after_it() {
        let found = hunks("a\nb\nc\n", "a\nc\n");
        assert_eq!((found[0].start, found[0].len), (1, 0));
        assert!(hunk_at(&found, 1).is_some());
        assert!(hunk_at(&found, 0).is_none());
    }

    #[test]
    fn untracked_file_is_one_hunk() {
        assert_eq!(hunks("", "a\nb\n").len(), 1);
    }
}
