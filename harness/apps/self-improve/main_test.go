package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// A frame is what the user sees. Driving the model through the same messages
// bubbletea would send is the only check available without a tty, and it is the
// one that matters: it catches a layout that panics, a column that swallows its
// content, and a count that disagrees with the rows.
func frame(t *testing.T, rows []row) string {
	t.Helper()
	var m tea.Model = newModel(environment{})
	m, _ = m.Update(tea.WindowSizeMsg{Width: 120, Height: 30})
	m, _ = m.Update(loadedMsg{rows: rows})
	return m.View()
}

func TestViewShowsScoresAndCounts(t *testing.T) {
	rows := []row{
		{record: record{Session: "aaaa1111", Topic: "atuin export", Score: 2, Scope: "none", Why: "plain request"}, State: "fresh"},
		{record: record{Session: "bbbb2222", Topic: "spec rules", Score: 9, Scope: "global", Why: "no step numbers in code"}, State: "fresh"},
		{record: record{Session: "cccc3333", Score: -1, Scope: "-"}, State: "new", Queued: true},
	}
	out := frame(t, rows)

	for _, want := range []string{"3 sessions", "2 scored", "1 queued", "1 kept", "spec rules", "no step numbers"} {
		if !strings.Contains(out, want) {
			t.Errorf("frame is missing %q\n%s", want, out)
		}
	}
}

// The highest score first is the whole point of scoring: /dream and the reader
// both work down from the top.
func TestSortByScorePutsUnscoredLast(t *testing.T) {
	rows := []row{
		{record: record{Session: "a", Score: -1}},
		{record: record{Session: "b", Score: 9}},
		{record: record{Session: "c", Score: 3}},
	}
	sortRows(rows, byScore)

	if got := []string{rows[0].Session, rows[1].Session, rows[2].Session}; got[0] != "b" || got[1] != "c" || got[2] != "a" {
		t.Errorf("score order = %v, want [b c a]", got)
	}
}

// Recent order is the plan's own order (newest first), so the sort must leave it
// exactly as it arrived.
func TestSortByRecentPreservesPlanOrder(t *testing.T) {
	rows := []row{
		{record: record{Session: "a", Score: 1}},
		{record: record{Session: "b", Score: 9}},
	}
	sortRows(rows, byRecent)

	if rows[0].Session != "a" || rows[1].Session != "b" {
		t.Errorf("recent order = [%s %s], want [a b]", rows[0].Session, rows[1].Session)
	}
}

func TestProjectLabel(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no home directory")
	}
	encoded := strings.ReplaceAll(home, "/", "-")

	cases := map[string]string{
		filepath.Join("/p", encoded+"-git-dotfiles", "s.jsonl"):          "dotfiles",
		filepath.Join("/p", encoded+"-git-mil-tasks-MILAB-1", "s.jsonl"): "mil-tasks-MILAB-1",
		filepath.Join("/p", "-elsewhere-thing", "s.jsonl"):               "-elsewhere-thing",
		"": "-",
	}
	for path, want := range cases {
		if got := projectLabel(path); got != want {
			t.Errorf("projectLabel(%q) = %q, want %q", path, got, want)
		}
	}
}

// The three suggestion states have to be distinguishable at a glance, or a kept
// session waiting for its pass reads the same as one already judged covered.
func TestSuggestCellStates(t *testing.T) {
	cases := []struct {
		name string
		row  row
		want string
	}{
		{"verdict shown", row{record: record{Score: 8, Verdict: "extend"}}, "extend"},
		{"new-skill abbreviated", row{record: record{Score: 9, Verdict: "new-skill"}}, "new"},
		{"kept but not suggested yet", row{record: record{Score: keepScore}}, "queued"},
		{"below the threshold", row{record: record{Score: keepScore - 1}}, "–"},
		{"unscored", row{record: record{Score: -1}}, "–"},
	}
	for _, c := range cases {
		if got := c.row.suggestCell(); got != c.want {
			t.Errorf("%s: suggestCell() = %q, want %q", c.name, got, c.want)
		}
	}
}

func TestHeaderCountsSessionsAwaitingSuggestion(t *testing.T) {
	rows := []row{
		{record: record{Session: "a", Score: 8}},                     // kept, awaiting
		{record: record{Session: "b", Score: 7, Verdict: "covered"}}, // kept, done
		{record: record{Session: "c", Score: 2}},                     // not kept
	}
	if got := frame(t, rows); !strings.Contains(got, "1 to suggest") {
		t.Errorf("header should count one session awaiting a suggestion\n%s", got)
	}
}

func TestDetailShowsSuggestionAndQueuedHint(t *testing.T) {
	withVerdict := []row{{record: record{
		Session: "a", Score: 8, Verdict: "extend",
		Target:     "/Users/x/.claude/skills/claim-evidence/SKILL.md",
		Suggestion: "/Users/x/.claude/self-improvement/suggestions/a.md",
	}}}
	out := detailFrame(t, withVerdict)
	for _, want := range []string{"suggestion", "extend", "claim-evidence", "o to open"} {
		if !strings.Contains(out, want) {
			t.Errorf("detail is missing %q\n%s", want, out)
		}
	}

	awaiting := []row{{record: record{Session: "b", Score: 8}}}
	if out := detailFrame(t, awaiting); !strings.Contains(out, "suggestion queued") {
		t.Errorf("detail should offer to run the pass\n%s", out)
	}
}

func detailFrame(t *testing.T, rows []row) string {
	t.Helper()
	var m tea.Model = newModel(environment{})
	m, _ = m.Update(tea.WindowSizeMsg{Width: 120, Height: 30})
	m, _ = m.Update(loadedMsg{rows: rows})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	return m.View()
}

// A record whose transcript is gone still has to reach the screen: its score may
// be the only surviving trace of a session Claude Code already pruned.
func TestDetailViewOfReapedRecord(t *testing.T) {
	rows := []row{{
		record: record{
			Session: "dead", Score: 7, Scope: "project", Why: "repo runs mise, not make",
			Watermark: 120, Updated: "2026-08-18T00:00:00Z",
			Passes: []pass{{From: 0, To: 120, Score: 7, Scope: "project", Why: "repo runs mise, not make", At: "2026-08-18T00:00:00Z"}},
		},
		State: "gone",
	}}

	var m tea.Model = newModel(environment{})
	m, _ = m.Update(tea.WindowSizeMsg{Width: 120, Height: 30})
	m, _ = m.Update(loadedMsg{rows: rows})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	out := m.View()

	for _, want := range []string{"dead", "gone", "line 120", "passes", "mise, not make"} {
		if !strings.Contains(out, want) {
			t.Errorf("detail view is missing %q\n%s", want, out)
		}
	}
}
