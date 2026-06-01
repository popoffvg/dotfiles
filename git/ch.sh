#!/bin/bash
git_show() {
    branch_commits='git log --graph --color --format="%C(white)%h - %C(green)%cs - %C(blue)%s%C(red)%d"' \
    && all_commits='git log --all --graph --color --format="%C(white)%h - %C(green)%cs - %C(blue)%s%C(red)%d"' \
    && eval "$branch_commits" | fzf \
      --ansi \
      --reverse \
      --no-sort \
      --prompt="Branch > " \
      --preview='
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git show --color $hash
        ' \
      --bind="ctrl-s:transform:[[ \$FZF_PROMPT =~ 'Branch >' ]] \
        && echo 'change-prompt(All > )+reload($all_commits)' \
        || echo 'change-prompt(Branch > )+reload($branch_commits)'" \
      --bind='enter:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && sh -c "git show --color $hash | less -R"
        )' \
      --bind='ctrl-c:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        &&  git checkout $hash
        )+abort' \
      --bind='ctrl-r:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git reset $hash
        )+abort' \
      --bind='ctrl-i:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git rebase --interactive $hash
        )+abort' \
      --bind='ctrl-p:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git cherry-pick $hash
        )+abort' \
      --bind='ctrl-f:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git commit -a --fixup=$hash --no-verify \
        && git rebase --autosquash --interactive $hash~1
        )+abort' \
      --header-first \
      --header '
      > ENTER to display the diff
      > ctrl-C to checkout the commit | ALT-R to reset to the commit
      > ctrl-I to rebase interactively
      > ctrl-P to cherry pick
      > ctrl-F to fixup
      '
    }

    git_show
