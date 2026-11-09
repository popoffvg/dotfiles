package main

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// A command is one board change. The TUI command line and the agent CLI run the same table,
// so an agent can do every change the operator can.
type command struct {
	name  string
	usage string
	args  int
	query bool
	run   func(b *board, args []string) (string, error)
}

var commands = []command{
	{name: "ls", usage: "ls", args: 0, query: true, run: cmdList},
	{name: "mkdir", usage: "mkdir <folder>", args: 1, run: cmdMkdir},
	{name: "mv", usage: "mv <id> <folder>", args: 2, run: cmdMove},
	{name: "review", usage: "review <id> <user>", args: 2, run: cmdReview},
	{name: "assign", usage: "assign <id> <you|agent>", args: 2, run: cmdAssign},
	{name: "task", usage: "task <folder> <title>", args: 2, run: cmdTask},
	{name: "open", usage: "open <id>", args: 1, query: true, run: cmdOpen},
}

// runCommand parses one line, runs it, and logs it under the actor. The last argument takes the rest of the line.
func runCommand(b *board, by actor, line string) (string, error) {
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return "", fmt.Errorf("empty command")
	}
	for _, c := range commands {
		if c.name != fields[0] {
			continue
		}
		args := fields[1:]
		if len(args) < c.args {
			return "", fmt.Errorf("usage: %s", c.usage)
		}
		if c.args > 0 {
			args = append(args[:c.args-1], strings.Join(args[c.args-1:], " "))
		}
		out, err := c.run(b, args)
		if err != nil {
			return "", err
		}
		if !c.query {
			b.Log = append(b.Log, logEntry{By: by, Text: line})
		}
		return out, nil
	}
	return "", fmt.Errorf("unknown command %q", fields[0])
}

func cmdList(b *board, _ []string) (string, error) {
	out, err := json.MarshalIndent(b, "", "  ")
	return string(out), err
}

func cmdMkdir(b *board, a []string) (string, error) {
	if b.hasFolder(a[0]) {
		return "", fmt.Errorf("folder %q exists", a[0])
	}
	b.Folders = append(b.Folders, folder{Name: a[0]})
	return "created " + a[0], nil
}

// cmdMove moves the item and its upstack: a stack stays in one folder.
func cmdMove(b *board, a []string) (string, error) {
	it := b.find(a[0])
	if it == nil {
		return "", fmt.Errorf("no item %s", a[0])
	}
	if !b.hasFolder(a[1]) {
		return "", fmt.Errorf("no folder %q", a[1])
	}
	moved := []string{it.ID}
	it.Folder = a[1]
	for _, r := range b.upstack(it.ID) {
		r.Folder = a[1]
		moved = append(moved, r.ID)
	}
	return fmt.Sprintf("moved %s to %s", strings.Join(moved, " "), a[1]), nil
}

func cmdReview(b *board, a []string) (string, error) {
	it := b.find(a[0])
	if it == nil || it.Kind != kindPR {
		return "", fmt.Errorf("no PR %s", a[0])
	}
	it.Review = "pending"
	return fmt.Sprintf("requested review of %s from %s", it.ID, a[1]), nil
}

func cmdAssign(b *board, a []string) (string, error) {
	it := b.find(a[0])
	if it == nil {
		return "", fmt.Errorf("no item %s", a[0])
	}
	if a[1] != string(actorYou) && a[1] != string(actorAgent) {
		return "", fmt.Errorf("owner must be you or agent")
	}
	it.Owner = actor(a[1])
	return fmt.Sprintf("%s now belongs to %s", it.ID, a[1]), nil
}

func cmdTask(b *board, a []string) (string, error) {
	if !b.hasFolder(a[0]) {
		return "", fmt.Errorf("no folder %q", a[0])
	}
	id := fmt.Sprintf("T-%d", len(b.Items)+1)
	b.Items = append(b.Items, &item{ID: id, Kind: kindTask, Folder: a[0], Title: a[1], Owner: actorYou})
	return "created " + id, nil
}

func cmdOpen(b *board, a []string) (string, error) {
	it := b.find(a[0])
	if it == nil || it.Kind != kindPR {
		return "", fmt.Errorf("no PR %s", a[0])
	}
	if err := exec.Command("open", it.url()).Start(); err != nil {
		return "", err
	}
	return "opened " + it.url(), nil
}
