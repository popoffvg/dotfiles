# git-agent-review — pick commits, pick changed files, open in Helix with @agent comment ready
#
# Usage:
#   git-agent-review           # interactive: pick commits then files
#   git-agent-review --staged  # staged files only (no commit picker)
#   git-agent-review --all     # all tracked modified files (working tree)
#
# Comment convention (insert near the code you want the agent to act on):
#   Go/Rust/TS/JS/C:   // @agent: <instruction>
#   Python/Shell/YAML:  # @agent: <instruction>
#   SQL:               -- @agent: <instruction>
#   HTML/XML:          <!-- @agent: <instruction> -->

function git-agent-review --description "Pick commits, review changed files, open in Helix"
    # ── parse flags ──────────────────────────────────────────────────────────
    set -l mode commits  # commits | staged | all
    for arg in $argv
        switch $arg
            case --staged; set mode staged
            case --all;    set mode all
            case --commits; set mode commits
        end
    end

    # ── verify we're inside a git repo ───────────────────────────────────────
    if not git rev-parse --git-dir >/dev/null 2>&1
        echo "git-agent-review: not inside a git repo" >&2
        return 1
    end

    set -l repo_root (git rev-parse --show-toplevel)

    # ── helper: open files in helix ──────────────────────────────────────────
    # Supports "file:line" format from delta output
    function _gar_open_in_helix
        set -l files $argv
        if test (count $files) -eq 0
            return 0
        end
        # Build helix args: "path:line" → hx path:line, plain path → hx path
        set -l hx_args
        for f in $files
            # Strip leading repo-relative prefix if any
            set hx_args $hx_args $f
        end
        hx $hx_args
    end

    # ── stage 1: resolve the set of commits (or skip) ─────────────────────────
    set -l commit_range ""

    if test $mode = commits
        # Show git log, let user pick one or more commits with fzf
        # Preview shows the full diff for the highlighted commit
        set -l log_format "%C(yellow)%h%Creset %C(cyan)%as%Creset %C(bold)%s%Creset %C(dim)(%an)%Creset"

        set -l picked_commits (
            git log --color=always --format="$log_format" HEAD~50..HEAD 2>/dev/null \
            | fzf \
                --ansi \
                --multi \
                --prompt="Pick commits (TAB=multi, ENTER=confirm): " \
                --header="Select the commits you want to review" \
                --preview='git show --stat --color=always {1}' \
                --preview-window='right:55%:wrap' \
                --bind='ctrl-d:preview-page-down,ctrl-u:preview-page-up' \
            | awk '{print $1}'
        )

        if test (count $picked_commits) -eq 0
            echo "No commits selected." >&2
            return 0
        end

        # Build a range covering all picked commits
        # Collect all changed files across selected commits
        set -l all_changed_files
        for sha in $picked_commits
            for f in (git diff-tree --no-commit-id -r --name-only $sha 2>/dev/null)
                set all_changed_files $all_changed_files "$repo_root/$f"
            end
        end
        set -l unique_files (printf '%s\n' $all_changed_files | sort -u)

        # ── stage 2: pick files from those commits ────────────────────────────
        # Preview: show diff of this file across all picked commits
        set -l commits_joined (string join ' ' $picked_commits)

        set -l selected_files (
            printf '%s\n' $unique_files \
            | sed "s|$repo_root/||" \
            | fzf \
                --ansi \
                --multi \
                --prompt="Pick files to annotate (TAB=multi, ENTER=open in hx): " \
                --header="Files changed in selected commits  |  ctrl-p: diff  ctrl-o: file" \
                --preview="
                    _file={} ;
                    git diff --color=always $commits_joined -- \$_file 2>/dev/null \
                    | delta --line-numbers --syntax-theme=Dracula
                " \
                --preview-window='right:60%:wrap' \
                --bind='ctrl-p:change-preview(git diff --color=always '"$commits_joined"' -- {} | delta --line-numbers --syntax-theme=Dracula)' \
                --bind='ctrl-o:change-preview(bat --color=always --style=numbers,changes {})' \
                --bind='ctrl-d:preview-page-down,ctrl-u:preview-page-up'
        )

        if test (count $selected_files) -eq 0
            echo "No files selected." >&2
            return 0
        end

        _gar_open_in_helix $selected_files

    else if test $mode = staged
        # Staged files only
        set -l selected_files (
            git diff --cached --name-only \
            | fzf \
                --ansi \
                --multi \
                --prompt="Staged files (TAB=multi, ENTER=open in hx): " \
                --header="Staged changes  |  ctrl-p: diff  ctrl-o: file" \
                --preview="
                    git diff --cached --color=always -- {} \
                    | delta --line-numbers --syntax-theme=Dracula
                " \
                --preview-window='right:60%:wrap' \
                --bind='ctrl-p:change-preview(git diff --cached --color=always -- {} | delta --line-numbers --syntax-theme=Dracula)' \
                --bind='ctrl-o:change-preview(bat --color=always --style=numbers,changes {})' \
                --bind='ctrl-d:preview-page-down,ctrl-u:preview-page-up'
        )
        if test (count $selected_files) -eq 0
            echo "No files selected." >&2
            return 0
        end
        _gar_open_in_helix $selected_files

    else
        # Working-tree modified + untracked
        set -l selected_files (
            git diff --name-only HEAD \
            | fzf \
                --ansi \
                --multi \
                --prompt="Changed files (TAB=multi, ENTER=open in hx): " \
                --header="Working-tree changes  |  ctrl-p: diff  ctrl-o: file" \
                --preview="
                    git diff --color=always HEAD -- {} \
                    | delta --line-numbers --syntax-theme=Dracula
                " \
                --preview-window='right:60%:wrap' \
                --bind='ctrl-p:change-preview(git diff --color=always HEAD -- {} | delta --line-numbers --syntax-theme=Dracula)' \
                --bind='ctrl-o:change-preview(bat --color=always --style=numbers,changes {})' \
                --bind='ctrl-d:preview-page-down,ctrl-u:preview-page-up'
        )
        if test (count $selected_files) -eq 0
            echo "No files selected." >&2
            return 0
        end
        _gar_open_in_helix $selected_files
    end

    functions -e _gar_open_in_helix
end
