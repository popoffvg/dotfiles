package main

// fakeBoard is the mockup data. The real board reads GitHub through gh and keeps folders in a local file.
func fakeBoard() *board {
	return &board{
		Me: "popoffvg",
		Folders: []folder{
			{Name: "Inbox"},
			{Name: "Storage GC"},
			{Name: "Review for others"},
			{Name: "Chores"},
		},
		Items: []*item{
			{ID: "#412", Kind: kindPR, Folder: "Storage GC", Title: "Add the deletion queue", Repo: "mil/platforma", Branch: "gc/queue", Review: "approved", Owner: actorYou,
				Checks: []checkRun{{Name: "lint", State: checkPass}, {Name: "test", State: checkPass}, {Name: "build", State: checkPass}},
				Threads: []thread{
					{Path: "store/queue.go", Open: false, LastBy: "alice", Text: "LGTM"},
				}},
			{ID: "#415", Kind: kindPR, Folder: "Storage GC", Title: "Delete files from the queue", Repo: "mil/platforma", Branch: "gc/delete", Parent: "#412", Review: "changes", Owner: actorYou,
				Checks: []checkRun{{Name: "lint", State: checkPass}, {Name: "test", State: checkFail}, {Name: "build", State: checkPass}},
				Threads: []thread{
					{Path: "store/gc.go", Open: true, LastBy: "alice", Text: "Why not keep the dir until the restore ends?"},
					{Path: "store/queue.go", Open: true, LastBy: "bob", Text: "Name it pendingDeletes?"},
					{Path: "store/gc.go", Open: true, LastBy: "popoffvg", Text: "Fixed in the next commit."},
				}},
			{ID: "#419", Kind: kindPR, Folder: "Storage GC", Title: "Guard restore against GC", Repo: "mil/platforma", Branch: "gc/restore", Parent: "#415", Review: "pending", Owner: actorAgent,
				Checks: []checkRun{{Name: "lint", State: checkPass}, {Name: "test", State: checkRunning}}},
			{ID: "T-7", Kind: kindTask, Folder: "Storage GC", Title: "Write the Quint model for restore", Owner: actorAgent},
			{ID: "#388", Kind: kindPR, Folder: "Review for others", Title: "Bump block SDK to 1.42", Repo: "mil/blocks", Branch: "sdk-1.42", Review: "pending", Owner: actorAgent,
				Checks: []checkRun{{Name: "test", State: checkPass}},
				Threads: []thread{
					{Path: "package.json", Open: true, LastBy: "carol", Text: "Can you check the changelog first?"},
				}},
			{ID: "#401", Kind: kindPR, Folder: "Chores", Title: "Pin golangci-lint", Repo: "popoffvg/dotfiles", Branch: "lint-pin", Review: "approved", Owner: actorAgent,
				Checks: []checkRun{{Name: "lint", State: checkPass}}},
			{ID: "T-9", Kind: kindTask, Folder: "Inbox", Title: "Answer the review on #415", Owner: actorYou},
		},
		Log: []logEntry{
			{By: actorAgent, Text: "mkdir Chores"},
			{By: actorAgent, Text: "mv #401 Chores"},
			{By: actorAgent, Text: "review #388 alice"},
			{By: actorYou, Text: "mv #412 Storage GC"},
		},
	}
}
