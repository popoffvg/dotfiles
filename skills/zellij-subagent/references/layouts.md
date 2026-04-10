# Zellij Layouts for Multi-Agent Workflows

Predefined layouts for common multi-agent patterns. Save to `~/.config/zellij/layouts/` and launch with `zellij --layout <name>` or `zellij action new-tab --layout <path>`.

## Two-Agent Split (implement + review)

```kdl
// ~/.config/zellij/layouts/agent-pair.kdl
layout {
    tab name="agents" focus=true {
        pane split_direction="vertical" {
            pane size="50%" {
                name "agent-1"
                // command "claude"
                // args "-p" "--dangerously-skip-permissions" "task 1"
            }
            pane size="50%" {
                name "agent-2"
                // command "claude"
                // args "-p" "--dangerously-skip-permissions" "task 2"
            }
        }
    }
}
```

## Three-Agent Research Layout

```kdl
// ~/.config/zellij/layouts/agent-research.kdl
layout {
    tab name="research" focus=true {
        pane split_direction="vertical" {
            pane size="33%" {
                name "research-1"
            }
            pane size="34%" {
                name "research-2"
            }
            pane size="33%" {
                name "research-3"
            }
        }
    }
    tab name="synthesis" {
        pane {
            name "synthesizer"
        }
    }
}
```

## Agent + Monitor Layout

One large pane for the primary agent, a smaller pane for monitoring (git status, test output, logs).

```kdl
// ~/.config/zellij/layouts/agent-monitor.kdl
layout {
    tab name="work" focus=true {
        pane split_direction="vertical" {
            pane size="70%" {
                name "agent"
            }
            pane size="30%" split_direction="horizontal" {
                pane size="50%" {
                    name "git-watch"
                    command "watch"
                    args "-n" "5" "git" "status" "--short"
                }
                pane size="50%" {
                    name "tests"
                    start_suspended true
                }
            }
        }
    }
}
```

## Dynamic Layout via CLI

When layouts are overkill, compose panes dynamically:

```bash
#!/usr/bin/env bash
# Launch N agents side by side
# Usage: launch-agents.sh "task1" "task2" "task3"

for task in "$@"; do
    label="${task:0:20}"
    zellij run -d right -n "agent: $label" -c -- \
        claude -p --dangerously-skip-permissions "$task"
done
```
