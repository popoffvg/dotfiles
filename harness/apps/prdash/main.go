package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// With no arguments prdash opens the TUI. With arguments it runs one board command and prints the result:
// this is the interface an agent calls, for example `prdash -as agent mv #419 Chores`.
func main() {
	as := flag.String("as", string(actorYou), "who runs the command: you or agent")
	flag.Parse()
	b := fakeBoard()

	if flag.NArg() > 0 {
		out, err := runCommand(b, actor(*as), strings.Join(flag.Args(), " "))
		if err != nil {
			fmt.Fprintln(os.Stderr, "prdash:", err)
			os.Exit(1)
		}
		fmt.Println(out)
		return
	}

	if _, err := tea.NewProgram(newModel(b), tea.WithAltScreen()).Run(); err != nil {
		fmt.Fprintln(os.Stderr, "prdash:", err)
		os.Exit(1)
	}
}
