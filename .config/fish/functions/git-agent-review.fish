# Thin wrapper — real logic lives in scripts/git-agent-review (bash)
function git-agent-review --description "Pick commits, review changed files, open in Helix"
    command git-agent-review $argv
end
