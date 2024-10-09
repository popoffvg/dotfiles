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
      --bind='alt-c:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        &&  git checkout $hash
        )+abort' \
      --bind='alt-r:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git reset $hash
        )+abort' \
      --bind='alt-i:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git rebase --interactive $hash
        )+abort' \
      --bind='alt-p:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git cherry-pick $hash
        )+abort' \
      --bind='alt-f:execute(
        hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | sed -n "1p") \
        && [[ $hash != "" ]] \
        && git commit -a --fixup=$hash --no-verify \
        && git rebase --autosquash --interactive $hash~1
        )+abort' \
      --header-first \
      --header '
      > ENTER to display the diff
      > ALT-C to checkout the commit | ALT-R to reset to the commit
      > ALT-I to rebase interactively
      > ALT-P to cherry pick
      > ALT-F to fixup
      '
    }

    git_show
