#!/bin/bash

get_git_branch() {
    local repo_path="$1"

    # Change to the repository directory
    cd "$repo_path" || return

    # Get the current branch name
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

    # If the branch is found, print it
    if [ -n "$branch" ]; then
        echo "Repository: $repo_path Branch: $branch"
        echo ""
    fi
}

# Function to traverse directories and check for git repositories
root_dir="$(pwd)"

# Find all directories containing a .git folder
find "$root_dir" -type d -name ".git" | while read -r git_dir; do
    repo_path=$(dirname "$git_dir")  # Get the parent directory (i.e., the repo)
    get_git_branch "$repo_path"
done
