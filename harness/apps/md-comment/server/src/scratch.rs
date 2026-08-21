//! The scratch files under `.tmp/` that the server hands to the operator.
//!
//! One file per hand-over, deleted once it is spent. A single reused path is what made
//! Zed ask whether to overwrite: the editor keeps the tab of the previous hand-over open
//! on that path, so rewriting it is a write underneath a live buffer — which the editor
//! reports as a conflicting change on disk. A name nothing holds open cannot conflict.
//!
//! The nonce is the millisecond the hand-over ran, so the names sort into the order they
//! were minted in.

/// Where the operator types a comment.
pub const INPUT: &str = "md-comment-input";
/// The rendered view of the export, opened by `list comments`.
pub const LIST: &str = "md-comment-list";

/// `<stem>-<nonce>.md`. The caller picks a nonce no file under `.tmp/` uses.
pub fn file_name(stem: &str, nonce: u128) -> String {
    format!("{stem}-{nonce}.md")
}

/// Whether a file name is a hand-over of this kind. The watch reports a path, not which
/// glob matched it, and a leftover from an earlier run is recognised by its name alone.
pub fn is_file_name(stem: &str, name: &str) -> bool {
    let Some(nonce) = name
        .strip_prefix(stem)
        .and_then(|rest| rest.strip_prefix('-'))
        .and_then(|rest| rest.strip_suffix(".md"))
    else {
        return false;
    };
    !nonce.is_empty() && nonce.bytes().all(|byte| byte.is_ascii_digit())
}

/// The pattern a watch registers: every hand-over of this kind, the ones not minted yet
/// included.
pub fn file_glob(stem: &str) -> String {
    format!("{stem}-*.md")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_name_is_fresh_and_recognised() {
        assert_eq!(
            file_name(INPUT, 1755769123456),
            "md-comment-input-1755769123456.md"
        );
        assert_ne!(file_name(INPUT, 1), file_name(INPUT, 2));
        assert!(is_file_name(INPUT, &file_name(INPUT, 1)));
        assert!(is_file_name(LIST, &file_name(LIST, u128::MAX)));
    }

    #[test]
    fn one_kind_never_answers_for_another() {
        assert!(!is_file_name(INPUT, &file_name(LIST, 7)));
        assert!(!is_file_name(LIST, &file_name(INPUT, 7)));
    }

    #[test]
    fn the_other_scratch_files_are_not_hand_overs() {
        for name in [
            "md-comment.md",
            "md-comment.json",
            "md-comment-input.md",
            "md-comment-input-.md",
            "md-comment-input-x.md",
            "md-comment-input-1.txt",
        ] {
            assert!(!is_file_name(INPUT, name), "{name} is not a hand-over");
        }
    }

    #[test]
    fn the_glob_covers_a_minted_name() {
        let glob = file_glob(INPUT);
        let (head, tail) = glob.split_once('*').unwrap();
        let name = file_name(INPUT, 7);
        assert!(name.starts_with(head) && name.ends_with(tail));
    }
}
