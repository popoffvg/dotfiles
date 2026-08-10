//! Line anchoring: hashing, position arithmetic, shifting and reconciling.

use sha2::{Digest, Sha256};

use crate::store::Comment;

/// First 16 hex characters of the SHA-256 of the line without trailing whitespace.
pub fn line_hash(line: &str) -> String {
    let digest = Sha256::digest(line.trim_end().as_bytes());
    digest.iter().take(8).map(|b| format!("{b:02x}")).collect()
}

pub fn lines(text: &str) -> Vec<&str> {
    text.split('\n')
        .map(|l| l.strip_suffix('\r').unwrap_or(l))
        .collect()
}

/// UTF-16 code units in the line — the character offset that puts a hint at the line end.
pub fn utf16_len(line: &str) -> u32 {
    line.chars().map(|c| c.len_utf16() as u32).sum()
}

/// Byte offset of an LSP position. Out-of-range positions clamp to the end of the text.
pub fn byte_offset(text: &str, line: u32, character: u32) -> usize {
    let mut offset = 0usize;
    for (index, current) in text.split('\n').enumerate() {
        if index as u32 == line {
            let mut units = 0u32;
            for c in current.chars() {
                if units >= character {
                    return offset;
                }
                units += c.len_utf16() as u32;
                offset += c.len_utf8();
            }
            return offset;
        }
        offset += current.len() + 1;
    }
    text.len()
}

/// Replace the range with `new_text`. A `None` range replaces the whole document.
pub fn apply_change(text: &mut String, range: Option<(u32, u32, u32, u32)>, new_text: &str) {
    match range {
        None => *text = new_text.to_string(),
        Some((start_line, start_character, end_line, end_character)) => {
            let start = byte_offset(text, start_line, start_character);
            let end = byte_offset(text, end_line, end_character).max(start);
            text.replace_range(start..end, new_text);
        }
    }
}

/// Move the anchors of one file across a single incremental change.
///
/// Returns the store indices whose anchored line changed content, so the caller
/// can recompute their hashes from the text after the change is applied.
pub fn shift_for_change(
    comments: &mut [Comment],
    start_line: u32,
    end_line: u32,
    new_text: &str,
) -> Vec<usize> {
    let removed = end_line.saturating_sub(start_line) as i64;
    let added = new_text.matches('\n').count() as i64;
    let delta = added - removed;
    let mut touched = Vec::new();

    for (index, comment) in comments.iter_mut().enumerate() {
        let anchored = (comment.line - 1) as i64;
        if anchored > end_line as i64 {
            let moved = (anchored + delta).max(0);
            comment.line = moved as usize + 1;
        } else if anchored >= start_line as i64 {
            comment.line = start_line as usize + 1;
            touched.push(index);
        }
    }
    touched
}

/// Clamp every anchor into the document and refresh the hashes of `touched`.
pub fn rehash(text: &str, comments: &mut [Comment], touched: &[usize]) {
    let document = lines(text);
    let last = document.len().max(1);
    for comment in comments.iter_mut() {
        comment.line = comment.line.clamp(1, last);
    }
    for index in touched {
        if let Some(comment) = comments.get_mut(*index) {
            let anchored = comment.line - 1;
            comment.hash = line_hash(document.get(anchored).copied().unwrap_or(""));
            comment.orphaned = false;
        }
    }
}

/// Re-anchor every comment of a file by hash. The match nearest the stored line wins;
/// a comment with no match anywhere keeps its line and becomes orphaned.
pub fn reconcile(text: &str, comments: &mut [Comment]) {
    let document = lines(text);
    for comment in comments.iter_mut() {
        let anchored = comment.line - 1;
        if document
            .get(anchored)
            .is_some_and(|line| line_hash(line) == comment.hash)
        {
            comment.orphaned = false;
            continue;
        }
        let nearest = document
            .iter()
            .enumerate()
            .filter(|(_, line)| line_hash(line) == comment.hash)
            .min_by_key(|(index, _)| (*index as i64 - anchored as i64).abs())
            .map(|(index, _)| index);
        match nearest {
            Some(index) => {
                comment.line = index + 1;
                comment.orphaned = false;
            }
            None => comment.orphaned = true,
        }
    }
}
