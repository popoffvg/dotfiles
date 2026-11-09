package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
)

const listWidth = 48

var (
	dim     = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
	bold    = lipgloss.NewStyle().Bold(true)
	cursor  = lipgloss.NewStyle().Background(lipgloss.Color("236"))
	agentMk = lipgloss.NewStyle().Foreground(lipgloss.Color("5")).Render("◆")
	pane    = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("8")).Padding(0, 1)
	errText = lipgloss.NewStyle().Foreground(lipgloss.Color("1"))
	warn    = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
)

var checkGlyphs = map[check]string{
	checkPass:    lipgloss.NewStyle().Foreground(lipgloss.Color("2")).Render("✓"),
	checkFail:    lipgloss.NewStyle().Foreground(lipgloss.Color("1")).Render("✗"),
	checkRunning: lipgloss.NewStyle().Foreground(lipgloss.Color("3")).Render("●"),
	checkNone:    dim.Render("○"),
}

// A key is a board command an agent can also run. A key with run unset prefills the command line to edit first.
type commandKey struct {
	format string
	run    bool
}

var commandKeys = map[string]commandKey{
	"o": {format: "open %s", run: true},
	"m": {format: "mv %s "},
	"r": {format: "review %s "},
	"a": {format: "assign %s agent"},
}

// A listRow is a folder header when item is nil.
type listRow struct {
	folder string
	item   *item
	depth  int
}

type model struct {
	b         *board
	rows      []listRow
	cursor    int
	collapsed map[string]bool
	input     textinput.Model
	typing    bool
	status    string
	width     int
	height    int
}

func newModel(b *board) model {
	in := textinput.New()
	in.Prompt = ":"
	m := model{b: b, collapsed: map[string]bool{}, input: in}
	m.rebuild()
	return m
}

func (m *model) rebuild() {
	m.rows = nil
	for _, f := range m.b.Folders {
		m.rows = append(m.rows, listRow{folder: f.Name})
		if m.collapsed[f.Name] {
			continue
		}
		for _, s := range m.b.stack(f.Name) {
			m.rows = append(m.rows, listRow{folder: f.Name, item: s.item, depth: s.depth})
		}
	}
	m.cursor = clamp(m.cursor, 0, len(m.rows)-1)
}

func (m model) Init() tea.Cmd { return nil }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil
	case tea.KeyMsg:
		if m.typing {
			return m.updateInput(msg)
		}
		return m.updateList(msg)
	}
	return m, nil
}

func (m model) updateInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.typing = false
		m.input.Blur()
		return m, nil
	case "enter":
		m.typing = false
		m.input.Blur()
		return m.exec(m.input.Value())
	}
	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m model) updateList(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	row := m.rows[m.cursor]
	key := msg.String()
	if ck, ok := commandKeys[key]; ok && row.item != nil {
		line := fmt.Sprintf(ck.format, row.item.ID)
		if ck.run {
			return m.exec(line)
		}
		return m.prompt(line)
	}
	switch key {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "j", "down":
		m.cursor = clamp(m.cursor+1, 0, len(m.rows)-1)
	case "k", "up":
		m.cursor = clamp(m.cursor-1, 0, len(m.rows)-1)
	case "enter", " ":
		m.collapsed[row.folder] = !m.collapsed[row.folder]
		m.rebuild()
	case ":":
		return m.prompt("")
	}
	return m, nil
}

func (m model) exec(line string) (tea.Model, tea.Cmd) {
	out, err := runCommand(m.b, actorYou, line)
	m.status = out
	if err != nil {
		m.status = errText.Render(err.Error())
	}
	m.rebuild()
	return m, nil
}

func (m model) prompt(text string) (tea.Model, tea.Cmd) {
	m.typing = true
	m.input.SetValue(text)
	m.input.CursorEnd()
	return m, m.input.Focus()
}

func (m model) View() string {
	if m.width == 0 {
		return ""
	}
	logLines := 5
	bodyHeight := m.height - logLines - 6
	left := pane.Width(listWidth).Height(bodyHeight).Render(m.listView(bodyHeight))
	right := pane.Width(m.width - listWidth - 6).Height(bodyHeight).Render(m.detailView())
	return lipgloss.JoinVertical(lipgloss.Left,
		m.header(),
		lipgloss.JoinHorizontal(lipgloss.Top, left, right),
		m.logView(logLines),
		m.footer(),
	)
}

func (m model) header() string {
	var prs, tasks, agent int
	for _, it := range m.b.Items {
		if it.Kind == kindPR {
			prs++
		} else {
			tasks++
		}
		if it.Owner == actorAgent {
			agent++
		}
	}
	return bold.Render(" prdash ") + dim.Render(fmt.Sprintf("mockup · %d PRs · %d tasks · %s agent owns %d", prs, tasks, agentMk, agent))
}

func (m model) listView(height int) string {
	var lines []string
	for i, r := range m.rows {
		line := m.rowView(r)
		if i == m.cursor {
			line = cursor.Width(listWidth).Render(line)
		}
		lines = append(lines, line)
	}
	start := clamp(m.cursor-height+1, 0, len(lines))
	return strings.Join(lines[start:], "\n")
}

func (m model) rowView(r listRow) string {
	if r.item == nil {
		arrow := "▾"
		if m.collapsed[r.folder] {
			arrow = "▸"
		}
		return bold.Render(arrow + " " + r.folder)
	}
	it := r.item
	tree := strings.Repeat("  ", r.depth)
	if r.depth > 0 {
		tree = strings.Repeat("  ", r.depth-1) + "└─"
	}
	owner := " "
	if it.Owner == actorAgent {
		owner = agentMk
	}
	text := fmt.Sprintf("  %s%s %s %-5s %s", tree, checkGlyphs[it.ci()], owner, it.ID, m.waitMark(it)+it.Title)
	return ansi.Truncate(text, listWidth, "…")
}

func (m model) detailView() string {
	r := m.rows[m.cursor]
	if r.item == nil {
		return m.folderView(r.folder)
	}
	it := r.item
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s\n", bold.Render(it.ID), bold.Render(it.Title))
	if it.Kind == kindTask {
		fmt.Fprintf(&b, "%s\n\nowner  %s\n", dim.Render("task · no PR yet"), it.Owner)
		return b.String()
	}
	fmt.Fprintf(&b, "%s\n\n", dim.Render(it.Repo+" · "+it.Branch))
	fmt.Fprintf(&b, "stack   %s\n", m.stackPath(it))
	fmt.Fprintf(&b, "review  %s\n", it.Review)
	fmt.Fprintf(&b, "owner   %s\n\n", it.Owner)
	b.WriteString(m.checksView(it))
	b.WriteString(m.threadsView(it))
	b.WriteString(dim.Render("\no: open in the browser"))
	return b.String()
}

// stackPath shows the PR in its stack, from the trunk up: main ← #412 ← #415 ← #419.
func (m model) stackPath(it *item) string {
	path := []string{bold.Render(it.ID)}
	for p := m.b.find(it.Parent); p != nil; p = m.b.find(p.Parent) {
		path = append([]string{p.ID}, path...)
	}
	for _, up := range m.b.upstack(it.ID) {
		path = append(path, dim.Render(up.ID))
	}
	return "main ← " + strings.Join(path, " ← ")
}

func (m model) folderView(name string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s\n\n", bold.Render(name))
	for _, s := range m.b.stack(name) {
		fmt.Fprintf(&b, "%s %-5s %s\n", checkGlyphs[s.item.ci()], s.item.ID, m.waitMark(s.item)+s.item.Title)
	}
	b.WriteString(dim.Render("\nenter: fold · :mkdir <folder> · m: move a stack here"))
	return b.String()
}

func (m model) logView(n int) string {
	start := clamp(len(m.b.Log)-n, 0, len(m.b.Log))
	var lines []string
	for _, e := range m.b.Log[start:] {
		who := dim.Render("you  ")
		if e.By == actorAgent {
			who = agentMk + dim.Render("agent")
		}
		lines = append(lines, fmt.Sprintf(" %s %s", who, e.Text))
	}
	return pane.Width(m.width - 4).Render(strings.Join(lines, "\n"))
}

func (m model) footer() string {
	if m.typing {
		return m.input.View()
	}
	help := dim.Render("j/k move · enter fold · o open · m move · r review · a give to agent · : command · q quit")
	if m.status != "" {
		return m.status + "  " + help
	}
	return help
}

func clamp(v, lo, hi int) int {
	return max(lo, min(v, hi))
}

// waitMark counts the threads that wait for my answer, for example "↩2 ".
func (m model) waitMark(it *item) string {
	n := len(it.waiting(m.b.Me))
	if n == 0 {
		return ""
	}
	return warn.Render(fmt.Sprintf("↩%d ", n))
}

func (m model) checksView(it *item) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s %s\n", bold.Render("CI"), checkGlyphs[it.ci()], it.ci())
	for _, c := range it.Checks {
		fmt.Fprintf(&b, "  %s %s\n", checkGlyphs[c.State], c.Name)
	}
	return b.String() + "\n"
}

func (m model) threadsView(it *item) string {
	waiting := it.waiting(m.b.Me)
	var b strings.Builder
	fmt.Fprintf(&b, "%s %d open · %s\n", bold.Render("Comments"), it.openThreads(), warn.Render(fmt.Sprintf("%d wait for you", len(waiting))))
	for _, t := range waiting {
		fmt.Fprintf(&b, "  %s %-8s %s\n", warn.Render("↩"), t.LastBy, dim.Render(t.Path))
		fmt.Fprintf(&b, "    %q\n", t.Text)
	}
	return b.String()
}
