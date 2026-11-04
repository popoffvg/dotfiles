//! A pull request and its review threads, as one sync read them from GitHub.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Review {
    pub number: u64,
    pub title: String,
    pub url: String,
    /// The PR head commit. GitHub gives every thread line in this commit.
    pub head_oid: String,
    pub threads: Vec<Thread>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Thread {
    /// Relative to the repository root.
    pub path: String,
    /// 1-based, in the head commit. GitHub gives none for an outdated thread.
    pub start_line: Option<u32>,
    pub line: Option<u32>,
    /// `LEFT` is the base side of the diff: the line is not in the head commit.
    pub side: String,
    pub resolved: bool,
    pub outdated: bool,
    pub comments: Vec<Comment>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Comment {
    pub author: String,
    pub body: String,
    pub url: String,
    pub created_at: String,
    /// The diff lines GitHub shows above the comment, kept for a thread with no line.
    pub diff_hunk: String,
}

impl Thread {
    /// Open, current, and on the head side: a thread that has a line in the working tree.
    pub fn is_inline(&self) -> bool {
        !self.resolved && !self.outdated && self.side == "RIGHT" && self.line.is_some()
    }

    pub fn url(&self) -> &str {
        self.comments.first().map_or("", |comment| comment.url.as_str())
    }

    pub fn state(&self) -> &'static str {
        if self.resolved {
            "resolved"
        } else if self.outdated {
            "outdated"
        } else {
            "open"
        }
    }
}

/// Read the `pullRequest` object of the GraphQL answer that `github::QUERY` asks for.
pub fn from_graphql(answer: &Value) -> Result<Review, String> {
    let pull = &answer["data"]["repository"]["pullRequest"];
    if pull.is_null() {
        return Err(format!("pr-comments: the GraphQL answer has no pullRequest: {answer}"));
    }
    let threads = pull["reviewThreads"]["nodes"]
        .as_array()
        .map(|nodes| nodes.iter().map(thread_from_graphql).collect())
        .unwrap_or_default();
    Ok(Review {
        number: pull["number"].as_u64().unwrap_or_default(),
        title: text(&pull["title"]),
        url: text(&pull["url"]),
        head_oid: text(&pull["headRefOid"]),
        threads,
    })
}

fn thread_from_graphql(node: &Value) -> Thread {
    let comments = node["comments"]["nodes"]
        .as_array()
        .map(|nodes| {
            nodes
                .iter()
                .map(|comment| Comment {
                    author: text(&comment["author"]["login"]),
                    body: text(&comment["body"]),
                    url: text(&comment["url"]),
                    created_at: text(&comment["createdAt"]),
                    diff_hunk: text(&comment["diffHunk"]),
                })
                .collect()
        })
        .unwrap_or_default();
    Thread {
        path: text(&node["path"]),
        start_line: line(&node["startLine"]),
        line: line(&node["line"]),
        side: text(&node["diffSide"]),
        resolved: node["isResolved"].as_bool().unwrap_or_default(),
        outdated: node["isOutdated"].as_bool().unwrap_or_default(),
        comments,
    }
}

fn text(value: &Value) -> String {
    value.as_str().unwrap_or_default().to_string()
}

fn line(value: &Value) -> Option<u32> {
    value.as_u64().map(|line| line as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_threads_and_keeps_a_missing_line_as_none() {
        let answer = json!({"data": {"repository": {"pullRequest": {
            "number": 7, "title": "Retry", "url": "https://github.com/o/r/pull/7",
            "headRefOid": "abc",
            "reviewThreads": {"nodes": [
                {"path": "a.go", "line": 12, "startLine": null, "diffSide": "RIGHT",
                 "isResolved": false, "isOutdated": false,
                 "comments": {"nodes": [{"author": {"login": "alice"}, "body": "Why?",
                   "url": "https://github.com/o/r/pull/7#discussion_r1",
                   "createdAt": "2026-11-01T10:00:00Z", "diffHunk": "@@ -1 +1 @@"}]}},
                {"path": "b.go", "line": null, "startLine": null, "diffSide": "RIGHT",
                 "isResolved": false, "isOutdated": true, "comments": {"nodes": []}}
            ]}
        }}}});
        let review = from_graphql(&answer).unwrap();
        assert_eq!(review.number, 7);
        assert_eq!(review.threads[0].line, Some(12));
        assert_eq!(review.threads[0].comments[0].author, "alice");
        assert!(review.threads[0].is_inline());
        assert_eq!(review.threads[1].line, None);
        assert!(!review.threads[1].is_inline());
        assert_eq!(review.threads[1].state(), "outdated");
    }

    #[test]
    fn a_missing_pull_request_is_an_error() {
        assert!(from_graphql(&json!({"data": {"repository": {"pullRequest": null}}})).is_err());
    }
}
