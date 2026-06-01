
#!/bin/sh

branch_name="$1"
if [ -z "$1" ]; then
    branch_name=$(git branch --format="%(refname:short)" | fzf)
fi

if [ -z "$branch_name" ]; then
    exit 0
fi

 # Check if the branch already exists (locally or remotely)
if [ `git rev-parse --verify $branch_name 2>/dev/null` ]; then
        git switch "$branch_name"
        exit 0
fi

# Create and switch to the new branch
git checkout -b "$branch_name"

if [ $? -eq 0 ]; then
    echo "Successfully created and switched to branch '$branch_name'."
else
    echo "Failed to create branch '$branch_name'."
fi

exit 0

