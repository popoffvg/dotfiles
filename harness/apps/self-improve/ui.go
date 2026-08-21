package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var (
	styleHeader = lipgloss.NewStyle().Bold(true)
	styleDim    = lipgloss.NewStyle().Faint(true)
	styleKeep   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("2"))
	styleQueued = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	styleErr    = lipgloss.NewStyle().Foreground(lipgloss.Color("1"))
	styleLabel  = lipgloss.NewStyle().Faint(true).Width(12)
)

// keepScore mirrors the scan's threshold: at or above it the transcript is
// copied into lessons/ and /dream will see it. The TUI only marks the rows.
const keepScore = 6

type loadedMsg struct {
	rows []row
	err  error
}

type ranMsg struct {
	what string
	err  error
}

type model struct {
	env    environment
	rows   []row
	table  table.Model
	spin   spinner.Model
	sort   sortMode
	detail bool
	busy   string // non-empty while a script runs; what it is doing
	status string
	err    error
	width  int
	height int
}

func newModel(env environment) model {
	s := spinner.New()
	s.Spinner = spinner.Dot

	t := table.New(table.WithFocused(true))
	t.SetStyles(table.DefaultStyles())

	return model{env: env, table: t, spin: s, sort: byScore, busy: "loading"}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spin.Tick, loadCmd(m.env))
}

func loadCmd(env environment) tea.Cmd {
	return func() tea.Msg {
		rows, err := load(env)
		return loadedMsg{rows: rows, err: err}
	}
}

// runCmd shells out to the scan's own scripts. Every mutation the TUI offers is
// one of these — nothing here writes a record itself, so the TUI cannot produce
// a state the scan would not.
func runCmd(what string, name string, args ...string) tea.Cmd {
	return func() tea.Msg {
		cmd := exec.Command(name, args...)
		// The child is a `claude -p` call; keep it out of this terminal.
		cmd.Stdout, cmd.Stderr = nil, nil
		err := cmd.Run()
		return ranMsg{what: what, err: err}
	}
}

func (m model) selected() (row, bool) {
	if len(m.rows) == 0 {
		return row{}, false
	}
	i := m.table.Cursor()
	if i < 0 || i >= len(m.rows) {
		return row{}, false
	}
	return m.rows[i], true
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.layout()
		return m, nil

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spin, cmd = m.spin.Update(msg)
		return m, cmd

	case loadedMsg:
		m.busy = ""
		m.err = msg.err
		m.rows = msg.rows
		sortRows(m.rows, m.sort)
		m.layout()
		return m, nil

	case ranMsg:
		m.busy = ""
		if msg.err != nil {
			m.status = fmt.Sprintf("%s failed: %v", msg.what, msg.err)
		} else {
			m.status = msg.what + " done"
		}
		m.busy = "loading"
		return m, loadCmd(m.env)

	case tea.KeyMsg:
		if m.busy != "" && msg.String() != "ctrl+c" && msg.String() != "q" {
			return m, nil // a script is running; ignore everything but quit
		}
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit

		case "enter":
			m.detail = !m.detail
			return m, nil

		case "t":
			if m.sort == byScore {
				m.sort = byRecent
			} else {
				m.sort = byScore
			}
			sortRows(m.rows, m.sort)
			m.layout()
			return m, nil

		case "r":
			m.busy = "scan"
			return m, tea.Batch(m.spin.Tick, runCmd("scan", filepath.Join(m.env.scripts, "scan.sh")))

		case "a":
			m.busy = "full scan"
			return m, tea.Batch(m.spin.Tick, runCmd("full scan", filepath.Join(m.env.scripts, "scan.sh"), "--all"))

		case "s":
			r, ok := m.selected()
			if !ok || r.Path == "" {
				return m, nil
			}
			// Rescore means "judge the whole session again", so the record goes
			// first: score-session.sh keeps the highest score it has ever seen
			// for a session, and a stale record would swallow the new verdict.
			_ = os.Remove(filepath.Join(m.env.records, r.Session+".json"))
			m.busy = "score " + short(r.Session)
			return m, tea.Batch(m.spin.Tick,
				runCmd("score", filepath.Join(m.env.scripts, "score-session.sh"), r.Session, r.Path, "0"))

		case "g":
			// Suggest on demand, for any session — including one below the keep
			// threshold, where the scan would never spend the call itself but the
			// reader has decided otherwise.
			r, ok := m.selected()
			if !ok || r.Score < 0 {
				return m, nil
			}
			m.busy = "suggest " + short(r.Session)
			return m, tea.Batch(m.spin.Tick,
				runCmd("suggest", filepath.Join(m.env.scripts, "suggest-session.sh"), r.Session))

		case "o":
			// The host decides which editor: a TUI started from here would have
			// no tty of its own, and open-file.sh is what knows whether this
			// terminal sits in Zed, in a herdr pane, or on its own.
			r, ok := m.selected()
			if !ok || r.Suggestion == "" {
				m.status = "no suggestion to open"
				return m, nil
			}
			home, err := os.UserHomeDir()
			if err != nil {
				return m, nil
			}
			return m, runCmd("open",
				filepath.Join(home, ".claude", "scripts", "open-file.sh"), r.Suggestion)

		case "d":
			r, ok := m.selected()
			if !ok {
				return m, nil
			}
			if err := os.Remove(filepath.Join(m.env.records, r.Session+".json")); err != nil && !os.IsNotExist(err) {
				m.status = "delete failed: " + err.Error()
				return m, nil
			}
			m.status = "dropped record " + short(r.Session)
			m.busy = "loading"
			return m, loadCmd(m.env)
		}
	}

	var cmd tea.Cmd
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

// layout re-derives the columns from the current width. Score, scope and state
// are fixed; project, topic and reason share what is left, because those are the
// three that actually vary in length.
func (m *model) layout() {
	if m.width == 0 {
		return
	}
	free := m.width - (4 + 8 + 7 + 8 + 9) // fixed columns plus cell padding
	if free < 30 {
		free = 30
	}
	project := clamp(free/4, 10, 28)
	topic := clamp(free*2/5, 12, 44)
	why := free - project - topic
	if why < 12 {
		why = 12
	}

	m.table.SetColumns([]table.Column{
		{Title: "score", Width: 5},
		{Title: "scope", Width: 7},
		{Title: "state", Width: 6},
		{Title: "sug", Width: 7},
		{Title: "project", Width: project},
		{Title: "topic", Width: topic},
		{Title: "why", Width: why},
	})

	rows := make([]table.Row, 0, len(m.rows))
	for _, r := range m.rows {
		rows = append(rows, table.Row{
			r.scoreCell(), dash(r.Scope), r.State, r.suggestCell(),
			truncate(r.Project, project), truncate(r.Topic, topic), truncate(r.Why, why),
		})
	}
	m.table.SetRows(rows)

	height := m.height - 6
	if height < 3 {
		height = 3
	}
	m.table.SetHeight(height)
}

func (m model) View() string {
	if m.err != nil {
		return styleErr.Render("error: "+m.err.Error()) + "\n\npress q to quit\n"
	}

	var b strings.Builder
	b.WriteString(m.header() + "\n")
	if m.detail {
		b.WriteString(m.detailView())
	} else {
		b.WriteString(m.table.View() + "\n")
	}
	b.WriteString(m.footer())
	return b.String()
}

func (m model) header() string {
	var scored, queued, kept, toSuggest int
	for _, r := range m.rows {
		if r.Score >= 0 {
			scored++
		}
		if r.Queued {
			queued++
		}
		if r.Score >= keepScore {
			kept++
		}
		if r.awaitingSuggestion() {
			toSuggest++
		}
	}
	counts := fmt.Sprintf("%d sessions · %d scored · %s · %s · %s",
		len(m.rows), scored, styleQueued.Render(fmt.Sprintf("%d queued", queued)),
		styleKeep.Render(fmt.Sprintf("%d kept", kept)),
		styleQueued.Render(fmt.Sprintf("%d to suggest", toSuggest)))
	return styleHeader.Render("self-improve") + "  " + counts
}

func (m model) footer() string {
	line := "enter detail · r scan · a scan all · s rescore · g suggest · o open · d drop · t sort:" + m.sort.String() + " · q quit"
	if m.busy != "" {
		return m.spin.View() + " " + m.busy + "…\n" + styleDim.Render(line)
	}
	if m.status != "" {
		return styleDim.Render(line) + "\n" + m.status
	}
	return styleDim.Render(line)
}

func (m model) detailView() string {
	r, ok := m.selected()
	if !ok {
		return "no session selected\n"
	}
	field := func(label, value string) string {
		if value == "" {
			value = "–"
		}
		return styleLabel.Render(label) + value + "\n"
	}

	var b strings.Builder
	b.WriteString("\n")
	b.WriteString(field("session", r.Session))
	b.WriteString(field("topic", r.Topic))
	b.WriteString(field("project", r.Project))
	b.WriteString(field("score", fmt.Sprintf("%s (%s) — %s", r.scoreCell(), dash(r.Scope), r.State)))
	b.WriteString(field("why", r.Why))
	b.WriteString(field("watermark", fmt.Sprintf("line %d, %d bytes seen", r.Watermark, r.SeenBytes)))
	b.WriteString(field("updated", r.Updated))
	b.WriteString(field("archive", r.Archive))
	b.WriteString(field("transcript", r.Path))

	if r.Verdict != "" {
		b.WriteString("\n" + styleHeader.Render("suggestion") + "\n")
		b.WriteString(field("verdict", r.Verdict))
		b.WriteString(field("target", r.Target))
		b.WriteString(field("file", r.Suggestion+"  (o to open)"))
	} else if r.awaitingSuggestion() {
		b.WriteString("\n" + styleQueued.Render("suggestion queued — g to run it now") + "\n")
	}

	if len(r.Passes) > 0 {
		b.WriteString("\n" + styleHeader.Render("passes") + "\n")
		for _, p := range r.Passes {
			b.WriteString(fmt.Sprintf("  lines %d–%d  %d/%s  %s  %s\n",
				p.From, p.To, p.Score, dash(p.Scope), styleDim.Render(p.At), p.Why))
		}
	}
	return b.String()
}

func short(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

func dash(s string) string {
	if s == "" {
		return "–"
	}
	return s
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func truncate(s string, w int) string {
	if w <= 1 || len(s) <= w {
		return s
	}
	return s[:w-1] + "…"
}
