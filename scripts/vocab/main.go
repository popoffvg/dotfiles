// vocab: translate RU<->EN, prefill input from the clipboard, append to a vocab file (no dupes).
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/lipgloss"
)

func defaultPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "vocab.tsv")
}

func vocabPath() string {
	if len(os.Args) > 1 {
		return os.Args[1]
	}
	return defaultPath()
}

// unknownPath is the backlog of words to learn (raw, untranslated).
func unknownPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "vocab-unknown.txt")
}

func pbpaste() string {
	out, _ := exec.Command("pbpaste").Output()
	return strings.TrimSpace(string(out))
}

// translate returns (translated text, detected source lang) via Google's free endpoint.
func translate(text, tl string) (string, string, error) {
	u := "https://translate.googleapis.com/translate_a/single?" + url.Values{
		"client": {"gtx"}, "sl": {"auto"}, "tl": {tl}, "dt": {"t"}, "q": {text},
	}.Encode()
	resp, err := http.Get(u)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var data []any
	if err := json.Unmarshal(body, &data); err != nil {
		return "", "", err
	}
	var b strings.Builder
	for _, seg := range data[0].([]any) {
		b.WriteString(seg.([]any)[0].(string))
	}
	return b.String(), data[2].(string), nil
}

// pair returns (en, ru) regardless of input language.
func pair(text string) (string, string, error) {
	en, src, err := translate(text, "en")
	if err != nil {
		return "", "", err
	}
	if src == "en" {
		ru, _, err := translate(text, "ru")
		return text, ru, err
	}
	return en, text, nil
}

func appendUnique(path, row string) (bool, error) {
	existing, _ := os.ReadFile(path)
	for _, ln := range strings.Split(string(existing), "\n") {
		if ln == row {
			return false, nil // dup
		}
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return false, err
	}
	defer f.Close()
	_, err = f.WriteString(row + "\n")
	return true, err
}

// ── Bubble Tea ──────────────────────────────────────────────────────────

type resultMsg struct {
	en, ru string
	dup    bool
	err    error
}

type model struct {
	ti    textinput.Model
	res   *resultMsg
	width int
}

var (
	enLabel  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("12")) // blue
	ruLabel  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("9"))  // red
	inLabel  = lipgloss.NewStyle().Bold(true)
	dimStyle = lipgloss.NewStyle().Faint(true)
)

type editorMsg struct {
	text string
	err  error
}

// openEditorCmd writes the current input to a temp file, opens $VISUAL/$EDITOR on it,
// and returns the saved contents as the new input.
func openEditorCmd(initial string) tea.Cmd {
	f, err := os.CreateTemp("", "vocab-*.txt")
	if err != nil {
		return func() tea.Msg { return editorMsg{err: err} }
	}
	f.WriteString(initial)
	name := f.Name()
	f.Close()

	editor := os.Getenv("VISUAL")
	if editor == "" {
		editor = os.Getenv("EDITOR")
	}
	if editor == "" {
		editor = "vi"
	}
	parts := strings.Fields(editor)
	cmd := exec.Command(parts[0], append(parts[1:], name)...)
	return tea.ExecProcess(cmd, func(err error) tea.Msg {
		if err != nil {
			os.Remove(name)
			return editorMsg{err: err}
		}
		b, rerr := os.ReadFile(name)
		os.Remove(name)
		return editorMsg{text: strings.TrimSpace(string(b)), err: rerr}
	})
}

func translateCmd(word string) tea.Cmd {
	return func() tea.Msg {
		en, ru, err := pair(word)
		if err != nil {
			return resultMsg{err: err}
		}
		dup, err := appendUnique(vocabPath(), en+"\t"+ru)
		return resultMsg{en: en, ru: ru, dup: dup, err: err}
	}
}

func (m model) Init() tea.Cmd {
	if word := strings.TrimSpace(m.ti.Value()); word != "" {
		return tea.Batch(textinput.Blink, translateCmd(word)) // translate the pasted buffer at once
	}
	return textinput.Blink
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.ti.Width = m.wrapWidth()
		return m, nil
	case resultMsg:
		m.res = &msg
		return m, nil
	case editorMsg:
		if msg.err != nil {
			m.res = &resultMsg{err: msg.err}
			return m, nil
		}
		m.ti.SetValue(msg.text)
		m.ti.CursorEnd()
		if msg.text == "" {
			return m, nil
		}
		m.res = nil
		return m, translateCmd(msg.text)
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC, tea.KeyEsc:
			return m, tea.Quit
		case tea.KeyCtrlG:
			return m, openEditorCmd(m.ti.Value())
		case tea.KeyEnter:
			word := strings.TrimSpace(m.ti.Value())
			if word == "" {
				return m, tea.Quit
			}
			m.res = nil
			return m, translateCmd(word)
		}
	}
	var cmd tea.Cmd
	m.ti, cmd = m.ti.Update(msg)
	return m, cmd
}

// wrapWidth returns 60% of the terminal width (0 = no limit, before first WindowSizeMsg).
func (m model) wrapWidth() int {
	return m.width * 60 / 100
}

func (m model) View() string {
	wrap := lipgloss.NewStyle().Width(m.wrapWidth()).Render
	s := dimStyle.Render("vocab → "+vocabPath()+"   (Enter translate · ^G editor · empty/Esc quit)") + "\n\n"
	s += inLabel.Render("input:") + "\n" + m.ti.View() + "\n" + dimStyle.Render("---") + "\n"
	if m.res != nil {
		r := m.res
		switch {
		case r.err != nil:
			s += ruLabel.Render("error: ") + r.err.Error() + "\n"
		default:
			dupTag := ""
			if r.dup {
				dupTag = dimStyle.Render("  (dup)")
			}
			s += enLabel.Render("english:") + "\n" + wrap(r.en) + "\n" +
				dimStyle.Render("---") + "\n" +
				ruLabel.Render("russian:") + "\n" + wrap(r.ru) + dupTag + "\n"
		}
	}
	return s
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "add" {
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "usage: vocab add <word>...")
			os.Exit(1)
		}
		for _, w := range os.Args[2:] {
			added, err := appendUnique(unknownPath(), strings.TrimSpace(w))
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			if !added {
				fmt.Printf("(dup) %s\n", w)
			}
		}
		return
	}

	if len(os.Args) > 1 && (os.Args[1] == "list" || os.Args[1] == "prune") {
		path := defaultPath()
		if len(os.Args) > 2 {
			path = os.Args[2]
		}
		switch os.Args[1] {
		case "list":
			b, err := os.ReadFile(path)
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			fmt.Print(string(b))
		case "prune":
			if err := os.WriteFile(path, nil, 0644); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
		}
		return
	}

	ti := textinput.New()
	ti.SetValue(pbpaste()) // prefill with the clipboard
	ti.Focus()
	ti.Prompt = ""
	ti.CursorEnd()
	if _, err := tea.NewProgram(model{ti: ti}).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
