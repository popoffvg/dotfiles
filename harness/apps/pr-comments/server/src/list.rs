//! The list page: every thread with its code and its comments, for Zed's markdown preview.
//!
//! The preview opens a `://` link in the browser and a `<path>:<line>` link in an editor at
//! that line, so the two links under each heading are the buttons of the page.

use std::path::Path;

use crate::placement::{locate, Span};
use crate::review::{Review, Thread};

const CONTEXT_LINES: u32 = 5;
const FENCE: &str = "````";

/// `sources` gives the head text and the current text of a repository path.
pub fn render(
    review: &Review,
    repo: &Path,
    mut sources: impl FnMut(&str) -> (Option<String>, Option<String>),
) -> String {
    let mut page = format!(
        "# PR #{} — {}\n\n[open PR in GitHub]({})\n",
        review.number, review.title, review.url
    );
    let mut threads: Vec<&Thread> = review.threads.iter().collect();
    threads.sort_by_key(|thread| (state_order(thread), thread.path.clone(), thread.line));
    for thread in threads {
        let (head, current) = sources(&thread.path);
        let placed = current
            .as_deref()
            .and_then(|current| locate(thread, head.as_deref(), current).map(|span| (span, current)));
        page.push('\n');
        page.push_str(&render_thread(thread, repo, placed));
    }
    page
}

fn state_order(thread: &Thread) -> u8 {
    match thread.state() {
        "open" => 0,
        "resolved" => 1,
        _ => 2,
    }
}

fn render_thread(thread: &Thread, repo: &Path, placed: Option<(Span, &str)>) -> String {
    let mut out = String::new();
    match placed {
        Some((span, current)) => {
            let moved = if span.moved { " · moved" } else { "" };
            let target = link_path(&repo.join(&thread.path));
            out.push_str(&format!(
                "## {}:{} · {}{moved}\n\n[open in GitHub]({}) · [go to source]({target}:{})\n\n",
                thread.path,
                span.end + 1,
                thread.state(),
                thread.url(),
                span.start + 1,
            ));
            out.push_str(&code_around(&thread.path, current, span));
        }
        None => {
            out.push_str(&format!(
                "## {} · {}\n\n[open in GitHub]({})\n\n",
                thread.path,
                thread.state(),
                thread.url()
            ));
            out.push_str(&hunk_tail(thread));
        }
    }
    for comment in &thread.comments {
        let date = comment.created_at.get(..10).unwrap_or(&comment.created_at);
        out.push_str(&format!("\n**{}** · {date}\n\n{}\n", comment.author, comment.body.trim()));
    }
    out
}

fn code_around(path: &str, current: &str, span: Span) -> String {
    let language = Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default();
    let first = span.start.saturating_sub(CONTEXT_LINES);
    let last = span.end + CONTEXT_LINES;
    let mut out = format!("{FENCE}{language}\n");
    for (index, line) in current.lines().enumerate() {
        let index = index as u32;
        if index < first || index > last {
            continue;
        }
        let mark = if index >= span.start && index <= span.end { '>' } else { '|' };
        out.push_str(&format!("{:>4} {mark} {line}\n", index + 1));
    }
    out.push_str(FENCE);
    out.push('\n');
    out
}

/// GitHub's diff hunk ends on the commented line, so its tail is the code of a thread that
/// has no line in the working tree.
fn hunk_tail(thread: &Thread) -> String {
    let hunk = thread.comments.first().map_or("", |comment| comment.diff_hunk.as_str());
    let lines: Vec<&str> = hunk.lines().filter(|line| !line.starts_with("@@")).collect();
    let tail = &lines[lines.len().saturating_sub(2 * CONTEXT_LINES as usize + 1)..];
    format!("{FENCE}diff\n{}\n{FENCE}\n", tail.join("\n"))
}

/// The preview decodes the link before it opens it; a raw space or parenthesis ends the link.
fn link_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace(' ', "%20")
        .replace('(', "%28")
        .replace(')', "%29")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::review::Comment;

    fn thread(path: &str, line: Option<u32>, resolved: bool) -> Thread {
        Thread {
            path: path.into(),
            start_line: None,
            line,
            side: "RIGHT".into(),
            resolved,
            outdated: line.is_none(),
            comments: vec![Comment {
                author: "alice".into(),
                body: "Check the status first.".into(),
                url: format!("https://github.com/o/r/pull/7#{path}"),
                created_at: "2026-11-01T10:00:00Z".into(),
                diff_hunk: "@@ -1,2 +1,2 @@\n a\n-b\n+B".into(),
            }],
        }
    }

    #[test]
    fn renders_open_threads_first_with_code_and_both_links() {
        let review = Review {
            number: 7,
            title: "Retry".into(),
            url: "https://github.com/o/r/pull/7".into(),
            head_oid: "abc".into(),
            threads: vec![thread("z.go", None, false), thread("my dir/a.go", Some(2), false)],
        };
        let page = render(&review, Path::new("/repo"), |_| (None, Some("one\ntwo\nthree\n".into())));
        let open = page.find("## my dir/a.go:2 · open").unwrap();
        let outdated = page.find("## z.go · outdated").unwrap();
        assert!(open < outdated);
        assert!(page.contains("[go to source](/repo/my%20dir/a.go:2)"));
        assert!(page.contains("   2 > two\n"));
        assert!(page.contains("````diff\n a\n-b\n+B\n````"));
        assert!(page.contains("**alice** · 2026-11-01\n\nCheck the status first."));
    }
}
