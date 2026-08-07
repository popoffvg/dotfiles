package vocabulary

import (
	"errors"
	"strings"
	"sync"
	"testing"
)

func TestNewEntryRejectsIncompleteForms(t *testing.T) {
	cases := []struct {
		name    string
		topic   string
		file    string
		purpose string
		wantErr error
	}{
		{"empty topic", "   ", "/a/b.md", "settings", ErrTopicEmpty},
		{"punctuation-only topic", "!!!", "/a/b.md", "settings", ErrTopicEmpty},
		{"empty file", "github-repo", "  ", "settings", ErrFileEmpty},
		{"relative file", "github-repo", "a/b.md", "settings", ErrFileRelative},
		{"empty purpose", "github-repo", "/a/b.md", "  ", ErrPurposeEmpty},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := NewEntry(testCase.topic, testCase.file, testCase.purpose)
			if !errors.Is(err, testCase.wantErr) {
				t.Fatalf("NewEntry(%q, %q, %q) err = %v, want %v",
					testCase.topic, testCase.file, testCase.purpose, err, testCase.wantErr)
			}
		})
	}
}

func TestNewEntryNormalizes(t *testing.T) {
	entry, err := NewEntry("  GitHub Repo_Settings ", "/tmp/../tmp/gh.md", "  where\tthe   repo settings live\n")
	if err != nil {
		t.Fatalf("NewEntry() err = %v, want nil", err)
	}
	if got, want := entry.Topic(), "github-repo-settings"; got != want {
		t.Errorf("Topic() = %q, want %q", got, want)
	}
	if got, want := entry.File(), "/tmp/gh.md"; got != want {
		t.Errorf("File() = %q, want %q", got, want)
	}
	if got, want := entry.Purpose(), "where the repo settings live"; got != want {
		t.Errorf("Purpose() = %q, want %q", got, want)
	}
}

func TestNormalizeTopicKeepsPathAndDotSeparators(t *testing.T) {
	if got, want := NormalizeTopic("Harness/Plugins.Sync"), "harness/plugins.sync"; got != want {
		t.Errorf("NormalizeTopic() = %q, want %q", got, want)
	}
}

func TestNormalizeTopicFoldsSameConceptToOneKey(t *testing.T) {
	written := []string{"GitHub Repo", "github_repo", "  github-repo  ", "GITHUB  REPO"}
	for _, form := range written {
		if got, want := NormalizeTopic(form), "github-repo"; got != want {
			t.Errorf("NormalizeTopic(%q) = %q, want %q", form, got, want)
		}
	}
}

func mustEntry(t *testing.T, topic, file, purpose string) Entry {
	t.Helper()
	entry, err := NewEntry(topic, file, purpose)
	if err != nil {
		t.Fatalf("NewEntry(%q, %q, %q) err = %v", topic, file, purpose, err)
	}
	return entry
}

func TestPutReportsFirstFiling(t *testing.T) {
	vocabulary := New()
	filing := vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings"))

	if filing.Replaced {
		t.Error("Replaced = true, want false for a new topic")
	}
	if filing.PreviousFile != "" {
		t.Errorf("PreviousFile = %q, want empty", filing.PreviousFile)
	}
	if len(filing.SharedWith) != 0 {
		t.Errorf("SharedWith = %v, want empty", filing.SharedWith)
	}
	if got, want := vocabulary.Len(), 1; got != want {
		t.Errorf("Len() = %d, want %d", got, want)
	}
}

func TestPutReportsMovedFile(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "github-repo", "/repo/old.md", "repo settings"))
	filing := vocabulary.Put(mustEntry(t, "GitHub_Repo", "/repo/new.md", "repo settings"))

	if !filing.Replaced {
		t.Error("Replaced = false, want true")
	}
	if got, want := filing.PreviousFile, "/repo/old.md"; got != want {
		t.Errorf("PreviousFile = %q, want %q", got, want)
	}
	if got, want := vocabulary.Len(), 1; got != want {
		t.Errorf("Len() = %d, want %d — the two spellings must fold into one entry", got, want)
	}
}

func TestPutOmitsPreviousFileWhenPathUnchanged(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings"))
	filing := vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings, restated"))

	if !filing.Replaced {
		t.Error("Replaced = false, want true")
	}
	if filing.PreviousFile != "" {
		t.Errorf("PreviousFile = %q, want empty when the file did not move", filing.PreviousFile)
	}
}

func TestPutReportsTopicsSharingOneFile(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "ci-secrets", "/repo/everything.md", "ci secrets"))
	vocabulary.Put(mustEntry(t, "branch-rules", "/repo/everything.md", "branch rules"))
	filing := vocabulary.Put(mustEntry(t, "release-flow", "/repo/everything.md", "release flow"))

	want := []string{"branch-rules", "ci-secrets"}
	if strings.Join(filing.SharedWith, ",") != strings.Join(want, ",") {
		t.Errorf("SharedWith = %v, want %v (sorted, excluding the topic just filed)", filing.SharedWith, want)
	}
}

func TestPutExcludesItselfFromSharedWithOnReplace(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings"))
	filing := vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings"))

	if len(filing.SharedWith) != 0 {
		t.Errorf("SharedWith = %v, want empty — a topic does not share a file with itself", filing.SharedWith)
	}
}

func TestListIsOrderedByTopic(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "zeta", "/repo/z.md", "z"))
	vocabulary.Put(mustEntry(t, "alpha", "/repo/a.md", "a"))
	vocabulary.Put(mustEntry(t, "mid", "/repo/m.md", "m"))

	var topics []string
	for _, entry := range vocabulary.List() {
		topics = append(topics, entry.Topic())
	}
	if got, want := strings.Join(topics, ","), "alpha,mid,zeta"; got != want {
		t.Errorf("List() topics = %q, want %q", got, want)
	}
}

func TestLookupMatchesTopicPurposeAndFile(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings and branch rules"))
	vocabulary.Put(mustEntry(t, "mise-tasks", "/repo/.mise.toml", "build and stow tasks"))

	cases := []struct {
		name  string
		query string
		want  string
	}{
		{"by topic", "GITHUB", "github-repo"},
		{"by purpose", "branch rules", "github-repo"},
		{"by file", ".mise.TOML", "mise-tasks"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			found := vocabulary.Lookup(testCase.query)
			if len(found) != 1 || found[0].Topic() != testCase.want {
				t.Fatalf("Lookup(%q) = %v, want exactly [%s]", testCase.query, found, testCase.want)
			}
		})
	}
}

func TestLookupEmptyQueryReturnsEverything(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "one", "/repo/1.md", "first"))
	vocabulary.Put(mustEntry(t, "two", "/repo/2.md", "second"))

	if got, want := len(vocabulary.Lookup("  ")), 2; got != want {
		t.Errorf("Lookup(blank) returned %d entries, want %d", got, want)
	}
}

func TestDropRemovesTopic(t *testing.T) {
	vocabulary := New()
	vocabulary.Put(mustEntry(t, "github-repo", "/repo/gh.md", "repo settings"))

	if err := vocabulary.Drop("GitHub Repo"); err != nil {
		t.Fatalf("Drop() err = %v, want nil — Drop must normalize like Put", err)
	}
	if got, want := vocabulary.Len(), 0; got != want {
		t.Errorf("Len() = %d, want %d", got, want)
	}
}

func TestDropUnknownTopicFails(t *testing.T) {
	if err := New().Drop("absent"); !errors.Is(err, ErrUnknownTopic) {
		t.Fatalf("Drop() err = %v, want ErrUnknownTopic", err)
	}
}

func TestConcurrentPutAndListAreSafe(t *testing.T) {
	vocabulary := New()
	var waitGroup sync.WaitGroup

	for index := range 50 {
		waitGroup.Add(2)
		go func(index int) {
			defer waitGroup.Done()
			vocabulary.Put(mustEntry(t, "topic-"+string(rune('a'+index%26)), "/repo/f.md", "purpose"))
		}(index)
		go func() {
			defer waitGroup.Done()
			vocabulary.Lookup("topic")
		}()
	}
	waitGroup.Wait()

	if vocabulary.Len() == 0 {
		t.Error("Len() = 0, want entries after concurrent Put calls")
	}
}
