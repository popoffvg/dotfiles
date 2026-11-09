package main

import "testing"

func TestMoveCarriesUpstack(t *testing.T) {
	b := fakeBoard()
	if _, err := runCommand(b, actorAgent, "mv #415 Chores"); err != nil {
		t.Fatal(err)
	}
	for id, want := range map[string]string{"#412": "Storage GC", "#415": "Chores", "#419": "Chores"} {
		if got := b.find(id).Folder; got != want {
			t.Errorf("%s in %q, want %q", id, got, want)
		}
	}
	if last := b.Log[len(b.Log)-1]; last.By != actorAgent || last.Text != "mv #415 Chores" {
		t.Errorf("log %+v", last)
	}
}

func TestFolderNameTakesRestOfLine(t *testing.T) {
	b := fakeBoard()
	if _, err := runCommand(b, actorYou, "mv T-9 Review for others"); err != nil {
		t.Fatal(err)
	}
	if got := b.find("T-9").Folder; got != "Review for others" {
		t.Errorf("T-9 in %q", got)
	}
}

func TestQueryIsNotLogged(t *testing.T) {
	b := fakeBoard()
	n := len(b.Log)
	if _, err := runCommand(b, actorAgent, "ls"); err != nil {
		t.Fatal(err)
	}
	if len(b.Log) != n {
		t.Errorf("ls changed the log")
	}
}

func TestCIShowsTheWorstCheck(t *testing.T) {
	b := fakeBoard()
	for id, want := range map[string]check{"#412": checkPass, "#415": checkFail, "#419": checkRunning, "T-7": checkNone} {
		if got := b.find(id).ci(); got != want {
			t.Errorf("%s ci %s, want %s", id, got, want)
		}
	}
}

func TestWaitingSkipsMyLastAnswerAndClosedThreads(t *testing.T) {
	b := fakeBoard()
	for id, want := range map[string]int{"#412": 0, "#415": 2, "#388": 1} {
		if got := len(b.find(id).waiting(b.Me)); got != want {
			t.Errorf("%s waiting %d, want %d", id, got, want)
		}
	}
}
