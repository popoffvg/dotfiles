package main

import "strings"

// An actor is who made a change: the operator in the TUI, or an agent through the CLI.
type actor string

const (
	actorYou   actor = "you"
	actorAgent actor = "agent"
)

type kind string

const (
	kindPR   kind = "pr"
	kindTask kind = "task"
)

type check string

const (
	checkPass    check = "pass"
	checkFail    check = "fail"
	checkRunning check = "running"
	checkNone    check = "none"
)

// checkRank orders the states of a check run: the PR shows the highest state of its runs.
var checkRank = map[check]int{checkNone: 0, checkPass: 1, checkRunning: 2, checkFail: 3}

type checkRun struct {
	Name  string `json:"name"`
	State check  `json:"state"`
}

// A thread is one review comment thread. LastBy is the GitHub login of its last comment.
type thread struct {
	Path   string `json:"path"`
	Open   bool   `json:"open"`
	LastBy string `json:"last_by"`
	Text   string `json:"text"`
}

// An item is one unit of work on the board: a PR, or a task with no PR yet.
// Parent is the ID of the PR below it in a stack; a stack root has none.
type item struct {
	ID      string     `json:"id"`
	Kind    kind       `json:"kind"`
	Folder  string     `json:"folder"`
	Title   string     `json:"title"`
	Repo    string     `json:"repo,omitempty"`
	Branch  string     `json:"branch,omitempty"`
	Parent  string     `json:"parent,omitempty"`
	Review  string     `json:"review,omitempty"`
	Owner   actor      `json:"owner"`
	Checks  []checkRun `json:"checks,omitempty"`
	Threads []thread   `json:"threads,omitempty"`
}

func (it *item) ci() check {
	worst := checkNone
	for _, c := range it.Checks {
		if checkRank[c.State] > checkRank[worst] {
			worst = c.State
		}
	}
	return worst
}

func (it *item) url() string {
	return "https://github.com/" + it.Repo + "/pull/" + strings.TrimPrefix(it.ID, "#")
}

// waiting returns the open threads whose last comment is not from me: they wait for my answer.
func (it *item) waiting(me string) []thread {
	var out []thread
	for _, t := range it.Threads {
		if t.Open && t.LastBy != me {
			out = append(out, t)
		}
	}
	return out
}

func (it *item) openThreads() int {
	n := 0
	for _, t := range it.Threads {
		if t.Open {
			n++
		}
	}
	return n
}

type folder struct {
	Name string `json:"name"`
}

type logEntry struct {
	By   actor  `json:"by"`
	Text string `json:"text"`
}

// Me is the GitHub login of the operator; a thread whose last comment is from another login waits for me.
type board struct {
	Me      string     `json:"me"`
	Folders []folder   `json:"folders"`
	Items   []*item    `json:"items"`
	Log     []logEntry `json:"log"`
}

func (b *board) find(id string) *item {
	for _, it := range b.Items {
		if it.ID == id {
			return it
		}
	}
	return nil
}

func (b *board) hasFolder(name string) bool {
	for _, f := range b.Folders {
		if f.Name == name {
			return true
		}
	}
	return false
}

// children returns the items stacked directly on parent; an empty parent gives the stack roots.
func (b *board) children(parent string) []*item {
	var out []*item
	for _, it := range b.Items {
		if it.Parent == parent {
			out = append(out, it)
		}
	}
	return out
}

// upstack returns every item stacked above id, depth first.
func (b *board) upstack(id string) []*item {
	var out []*item
	for _, it := range b.children(id) {
		out = append(out, it)
		out = append(out, b.upstack(it.ID)...)
	}
	return out
}

// stack returns the items of a folder in stack order, each with its depth.
func (b *board) stack(folderName string) []stackRow {
	var rows []stackRow
	var walk func(parent string, depth int)
	walk = func(parent string, depth int) {
		for _, it := range b.children(parent) {
			if it.Folder == folderName {
				rows = append(rows, stackRow{item: it, depth: depth})
				walk(it.ID, depth+1)
			}
		}
	}
	walk("", 0)
	return rows
}

type stackRow struct {
	item  *item
	depth int
}
