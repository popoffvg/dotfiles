//! Read the review threads of the PR of the current branch through the `gh` CLI.

use std::path::Path;
use std::process::Command;

use serde_json::Value;

use crate::review::{from_graphql, Review};

const NO_ACCESS: &str = "Could not resolve to a Repository with the name '";

/// Why a sync got no threads.
#[derive(Debug, PartialEq)]
pub enum FetchError {
    /// GitHub hides a repository the token cannot see, so it answers "Could not resolve".
    NoAccess {
        repository: String,
        /// The active gh account; None when GH_TOKEN is set, which overrides every account.
        active: Option<String>,
        /// The other logged-in accounts, the ones a switch can pick.
        others: Vec<String>,
    },
    Failed(String),
}

impl From<String> for FetchError {
    fn from(reason: String) -> FetchError {
        FetchError::Failed(reason)
    }
}

impl std::fmt::Display for FetchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FetchError::Failed(reason) => write!(f, "{reason}"),
            FetchError::NoAccess { repository, active: None, .. } => write!(
                f,
                "pr-comments: the token in GH_TOKEN cannot see {repository}. GH_TOKEN overrides \
                 every gh account: unset it, or set it to a token that can see the repository."
            ),
            FetchError::NoAccess { repository, active: Some(active), others } if others.is_empty() => write!(
                f,
                "pr-comments: the gh account {active} cannot see {repository}, and no other \
                 account is logged in. Run `gh auth login` with an account that can."
            ),
            FetchError::NoAccess { repository, active: Some(active), others } => write!(
                f,
                "pr-comments: the gh account {active} cannot see {repository}. Switch to an \
                 account that can: `gh auth switch --user {}`.",
                others.join(" | ")
            ),
        }
    }
}

/// Only GraphQL gives `isResolved`. A PR with more than 100 threads, or a thread with more
/// than 100 comments, is cut at 100.
const QUERY: &str = "query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number title url headRefOid
      reviewThreads(first: 100) {
        nodes {
          path line startLine diffSide isResolved isOutdated
          comments(first: 100) {
            nodes { author { login } body url createdAt diffHunk }
          }
        }
      }
    }
  }
}";

/// `progress` gets the share done in percent and the step that starts.
pub fn fetch(repo: &Path, progress: &mut impl FnMut(u32, &str)) -> Result<Review, FetchError> {
    progress(0, "finding the PR of the current branch");
    let pull_url = run(repo, "gh", &["pr", "view", "--json", "url", "--jq", ".url"])
        .map_err(|error| access_error(repo, error))?;
    let (owner, name, number) = parse_pull_url(pull_url.trim())?;
    progress(33, &format!("reading the review threads of PR #{number}"));
    let answer = run(
        repo,
        "gh",
        &[
            "api",
            "graphql",
            "-f",
            &format!("query={QUERY}"),
            "-f",
            &format!("owner={owner}"),
            "-f",
            &format!("name={name}"),
            "-F",
            &format!("number={number}"),
        ],
    )
    .map_err(|error| access_error(repo, error))?;
    let answer: Value = serde_json::from_str(&answer)
        .map_err(|error| format!("pr-comments: gh api graphql gave no JSON ({error})"))?;
    Ok(from_graphql(&answer)?)
}

pub fn switch_account(repo: &Path, login: &str) -> Result<(), String> {
    run(repo, "gh", &["auth", "switch", "--hostname", "github.com", "--user", login]).map(|_| ())
}

fn access_error(repo: &Path, error: String) -> FetchError {
    if error.contains("not on any branch") {
        let commit = run(repo, "git", &["rev-parse", "--short", "HEAD"]).unwrap_or_default();
        return FetchError::Failed(format!(
            "pr-comments: {} has a detached HEAD at {}, so gh cannot find its PR. Check out the PR branch, then sync again.",
            repo.display(),
            commit.trim()
        ));
    }
    let Some(repository) = repository_in(&error) else {
        return FetchError::Failed(error);
    };
    if std::env::var_os("GH_TOKEN").is_some() {
        return FetchError::NoAccess { repository, active: None, others: Vec::new() };
    }
    let accounts = run(
        repo,
        "gh",
        &["auth", "status", "--json", "hosts", "--jq", r#".hosts["github.com"][] | "\(.active) \(.login)""#],
    )
    .unwrap_or_default();
    let mut active = None;
    let mut others = Vec::new();
    for line in accounts.lines() {
        match line.split_once(' ') {
            Some(("true", login)) => active = Some(login.to_string()),
            Some((_, login)) => others.push(login.to_string()),
            None => {}
        }
    }
    FetchError::NoAccess { repository, active, others }
}

fn repository_in(error: &str) -> Option<String> {
    let rest = &error[error.find(NO_ACCESS)? + NO_ACCESS.len()..];
    Some(rest[..rest.find('\'')?].to_string())
}

/// The file as the commit holds it, or None when the commit is not in the local repo.
pub fn file_at(repo: &Path, commit: &str, path: &str) -> Option<String> {
    run(repo, "git", &["show", &format!("{commit}:{path}")]).ok()
}

/// `https://github.com/<owner>/<name>/pull/<number>`
fn parse_pull_url(url: &str) -> Result<(String, String, u64), String> {
    let parts: Vec<&str> = url.trim_end_matches('/').rsplit('/').take(4).collect();
    match parts.as_slice() {
        [number, "pull", name, owner] => number
            .parse()
            .map(|number| (owner.to_string(), name.to_string(), number))
            .map_err(|_| format!("pr-comments: no PR number in {url}")),
        _ => Err(format!("pr-comments: {url} is not a PR URL")),
    }
}

fn run(repo: &Path, program: &str, arguments: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(arguments)
        .current_dir(repo)
        .output()
        .map_err(|error| format!("pr-comments: cannot start {program} ({error})"))?;
    if !output.status.success() {
        return Err(format!(
            "pr-comments: {program} {} failed in {}: {}",
            arguments.first().unwrap_or(&""),
            repo.display(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_owner_name_and_number_from_a_pull_url() {
        assert_eq!(
            parse_pull_url("https://github.com/popoffvg/dotfiles/pull/4").unwrap(),
            ("popoffvg".to_string(), "dotfiles".to_string(), 4)
        );
        assert!(parse_pull_url("https://github.com/popoffvg/dotfiles").is_err());
    }

    #[test]
    fn reads_the_hidden_repository_from_the_gh_error() {
        let error = "pr-comments: gh pr failed: GraphQL: Could not resolve to a Repository with \
                     the name 'milaboratory/pl'. (repository)";
        assert_eq!(repository_in(error).as_deref(), Some("milaboratory/pl"));
        assert_eq!(repository_in("pr-comments: gh pr failed: no pull requests found"), None);
    }

    #[test]
    fn a_no_access_error_names_the_switch_command() {
        let error = FetchError::NoAccess {
            repository: "milaboratory/pl".into(),
            active: Some("popoffvg".into()),
            others: vec!["vgpopov".into()],
        };
        assert_eq!(
            error.to_string(),
            "pr-comments: the gh account popoffvg cannot see milaboratory/pl. Switch to an \
             account that can: `gh auth switch --user vgpopov`."
        );
    }
}
