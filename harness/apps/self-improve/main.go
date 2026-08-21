package main

import (
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
)

var version = "dev"

// Where the scan keeps its state, and where its scripts live. The TUI owns none
// of this — it reads the records the scan writes and calls the scan's own
// scripts, so there is exactly one implementation of the algorithm and the
// viewer cannot drift from it.
type environment struct {
	root    string // ~/.claude/self-improvement
	records string // <root>/sessions
	scripts string // <plugin>/scripts
}

func resolve() (environment, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return environment{}, err
	}

	root := envOr("SELF_IMPROVE_ROOT", filepath.Join(home, ".claude", "self-improvement"))
	env := environment{
		root:    root,
		records: envOr("SELF_IMPROVE_RECORDS_DIR", filepath.Join(root, "sessions")),
	}

	// The plugin source first, the plugin cache second: editing the source and
	// re-running the TUI has to exercise the edited scripts, not the copy
	// Claude Code made at install time.
	candidates := []string{
		os.Getenv("SELF_IMPROVE_PLUGIN_ROOT"),
		filepath.Join(home, "git", "dotfiles", "harness", "plugins", "self-improvement"),
	}
	if matches, _ := filepath.Glob(filepath.Join(home, ".claude", "plugins", "cache", "*", "self-improvement")); matches != nil {
		candidates = append(candidates, matches...)
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "scripts", "scan-plan.sh")); err == nil {
			env.scripts = filepath.Join(c, "scripts")
			return env, nil
		}
	}
	return env, fmt.Errorf("cannot find the self-improvement plugin; set SELF_IMPROVE_PLUGIN_ROOT")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	for _, arg := range os.Args[1:] {
		switch arg {
		case "-v", "--version":
			fmt.Printf("self-improve %s\n", version)
			return
		case "-h", "--help":
			fmt.Print(usage)
			return
		default:
			fmt.Fprintf(os.Stderr, "unknown argument: %s\n%s", arg, usage)
			os.Exit(2)
		}
	}

	env, err := resolve()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if _, err := tea.NewProgram(newModel(env), tea.WithAltScreen()).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

const usage = `self-improve — browse and drive the session-lesson scan

The scan itself runs unattended: the plugin's SessionStart hook kicks one pass
per session start, and each pass scores the sessions that have gone quiet since
the last one. This is the window onto it — what scored what, what is queued, and
the keys to score something now instead of waiting.

  self-improve            open the TUI
  self-improve --version

Keys are listed in the footer. State lives in $SELF_IMPROVE_ROOT
(default ~/.claude/self-improvement).
`
