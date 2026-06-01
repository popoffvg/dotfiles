#!/bin/bash

find_git_branch() {
    local repo_path="$1"
    local branch="$2"

    # Change to the repository directory
    cd "$repo_path" || return

    # Get the current branch name
    branches=$(git branch 2>/dev/null)

    # If the branch is found, print it
    for b in $branches; do
        if [[ "$b" == *"$branch"* ]]; then
            echo "Repository: $repo_path Branch: $branch"
        fi
    done
}

# Function to traverse directories and check for git repositories
root_dir="$(pwd)"
branch="$1"
if [ -z "$branch" ]; then
    read -p "Enter the branch name: " branch
fi

# Find all directories containing a .git folder
find "$root_dir" -type d -name ".git" | while read -r git_dir; do
    repo_path=$(dirname "$git_dir")  # Get the parent directory (i.e., the repo)
    find_git_branch "$repo_path" "$branch"
done

