package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// A record is one file in <root>/sessions. The scan writes it with jq; this is
// the same shape read back. Score -1 means the field was absent — a session the
// scan has queued but not judged.
type record struct {
	Session   string `json:"session"`
	Path      string `json:"transcript"`
	Topic     string `json:"topic"`
	Watermark int    `json:"watermark"`
	SeenBytes int64  `json:"seen_bytes"`
	Score     int    `json:"score"`
	Scope     string `json:"scope"`
	Why       string `json:"why"`
	Archive   string `json:"archive"`
	Updated   string `json:"updated"`
	Passes    []pass `json:"passes"`

	// Written by the suggestion stage, which runs only on a kept session.
	Suggestion  string `json:"suggestion"`
	Verdict     string `json:"suggestion_verdict"`
	Target      string `json:"suggestion_target"`
	SuggestedAt string `json:"suggested_at"`
}

type pass struct {
	From  int    `json:"from"`
	To    int    `json:"to"`
	Score int    `json:"score"`
	Scope string `json:"scope"`
	Why   string `json:"why"`
	At    string `json:"at"`
}

// One session as the TUI shows it: the scan's plan for it, joined with whatever
// its record already holds.
type row struct {
	record
	State   string // new | grown | fresh | wait | archived | gone
	Project string
	Queued  bool // the next scan would spend a model call on it
}

// load runs the scan's own planner rather than reimplementing the join, so the
// TUI can never disagree with what a scan would actually do. The plan is the
// list; the records only decorate it.
func load(env environment) ([]row, error) {
	out, err := exec.Command(filepath.Join(env.scripts, "scan-plan.sh")).Output()
	if err != nil {
		return nil, fmt.Errorf("scan-plan.sh: %w", err)
	}

	records := loadRecords(env.records)
	var rows []row
	for _, line := range strings.Split(strings.TrimRight(string(out), "\n"), "\n") {
		if line == "" {
			continue
		}
		f := strings.Split(line, "\t")
		if len(f) < 5 {
			continue
		}
		action, id, path, state := f[0], f[1], f[2], f[4]

		r, scored := records[id]
		if !scored {
			r = record{Session: id, Score: -1, Scope: "-"}
		}
		if r.Path == "" {
			r.Path = path
		}
		rows = append(rows, row{
			record:  r,
			State:   state,
			Project: projectLabel(r.Path),
			Queued:  action == "score",
		})
		delete(records, id)
	}

	// A record with no session left. The next scan reaps it; until then it is
	// worth showing, because its score may be the only trace of a transcript
	// Claude Code has already pruned.
	for _, r := range records {
		rows = append(rows, row{record: r, State: "gone", Project: projectLabel(r.Path)})
	}
	return rows, nil
}

func loadRecords(dir string) map[string]record {
	records := map[string]record{}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return records
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		r := record{Score: -1}
		if err := json.Unmarshal(raw, &r); err != nil || r.Session == "" {
			continue
		}
		records[r.Session] = r
	}
	return records
}

// projectLabel turns Claude Code's flattened project directory back into
// something readable. The encoding replaces every `/` with `-`, so it cannot be
// reversed exactly; dropping the home-directory prefix is what makes the
// remainder short enough to read, and that part is unambiguous.
func projectLabel(transcript string) string {
	if transcript == "" {
		return "-"
	}
	dir := filepath.Base(filepath.Dir(transcript))
	home, err := os.UserHomeDir()
	if err == nil {
		dir = strings.TrimPrefix(dir, strings.ReplaceAll(home, "/", "-")+"-")
	}
	dir = strings.TrimPrefix(dir, "git-")
	if dir == "" {
		return "-"
	}
	return dir
}

type sortMode int

const (
	byScore  sortMode = iota // what to harvest next
	byRecent                 // what just happened
)

func (m sortMode) String() string {
	if m == byScore {
		return "score"
	}
	return "recent"
}

func sortRows(rows []row, mode sortMode) {
	sort.SliceStable(rows, func(i, j int) bool {
		if mode == byScore && rows[i].Score != rows[j].Score {
			return rows[i].Score > rows[j].Score
		}
		// Plan order is already newest-first, so recency needs no key of its
		// own — only a stable sort that leaves it alone.
		return false
	})
}

func (r row) scoreCell() string {
	if r.Score < 0 {
		return "–"
	}
	return strconv.Itoa(r.Score)
}

// The suggestion column carries three distinct states, and the middle one is the
// one worth seeing: a session the scan has decided to suggest on but has not
// reached yet. Without it, a kept session with no verdict looks the same as one
// the pass judged already covered.
func (r row) suggestCell() string {
	switch {
	case r.Verdict != "":
		if r.Verdict == "new-skill" {
			return "new"
		}
		return r.Verdict
	case r.Score >= keepScore:
		return "queued"
	default:
		return "–"
	}
}

func (r row) awaitingSuggestion() bool {
	return r.Score >= keepScore && r.Verdict == ""
}
