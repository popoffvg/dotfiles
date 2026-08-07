// Package vocabulary holds the topic index: one topic points at the one file
// that carries the truth for it. The index lives only in memory for the
// lifetime of the process, so it is a routing map rebuilt each session, never a
// store of record.
package vocabulary

import (
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

var (
	ErrTopicEmpty   = errors.New("topic is empty")
	ErrFileEmpty    = errors.New("file is empty")
	ErrFileRelative = errors.New("file must be an absolute path")
	ErrPurposeEmpty = errors.New("purpose is empty")
	ErrUnknownTopic = errors.New("unknown topic")
)

// Entry is one topic bound to the single file that carries its truth, plus the
// purpose that says what the file is authoritative for. No invalid Entry
// exists: NewEntry rejects every incomplete form.
type Entry struct {
	topic   string
	file    string
	purpose string
}

// NewEntry normalizes the topic, requires an absolute file path, and requires a
// purpose. The purpose is mandatory because a topic without a stated purpose is
// how one file ends up collecting everything.
func NewEntry(topic, file, purpose string) (Entry, error) {
	normalizedTopic := NormalizeTopic(topic)
	if normalizedTopic == "" {
		return Entry{}, ErrTopicEmpty
	}

	trimmedFile := strings.TrimSpace(file)
	if trimmedFile == "" {
		return Entry{}, ErrFileEmpty
	}
	if !filepath.IsAbs(trimmedFile) {
		return Entry{}, fmt.Errorf("%w: %s", ErrFileRelative, trimmedFile)
	}

	collapsedPurpose := strings.Join(strings.Fields(purpose), " ")
	if collapsedPurpose == "" {
		return Entry{}, ErrPurposeEmpty
	}

	return Entry{
		topic:   normalizedTopic,
		file:    filepath.Clean(trimmedFile),
		purpose: collapsedPurpose,
	}, nil
}

func (e Entry) Topic() string   { return e.topic }
func (e Entry) File() string    { return e.file }
func (e Entry) Purpose() string { return e.purpose }

// NormalizeTopic folds a topic to lowercase kebab-case so the same concept
// written two ways lands in one entry instead of two.
func NormalizeTopic(topic string) string {
	lowered := strings.ToLower(strings.TrimSpace(topic))

	var builder strings.Builder
	previousWasSeparator := false
	for _, char := range lowered {
		switch {
		case char >= 'a' && char <= 'z', char >= '0' && char <= '9', char == '.', char == '/':
			builder.WriteRune(char)
			previousWasSeparator = false
		default:
			// Every other rune — space, underscore, punctuation — is a word
			// break, collapsed to a single hyphen.
			if !previousWasSeparator && builder.Len() > 0 {
				builder.WriteRune('-')
			}
			previousWasSeparator = true
		}
	}

	return strings.Trim(builder.String(), "-")
}

// Filing reports what Put changed. SharedWith names the other topics already
// pointing at the same file, which is the signal that one file is turning into
// the place where everything goes.
type Filing struct {
	Entry        Entry
	Replaced     bool
	PreviousFile string
	SharedWith   []string
}

// Vocabulary is the whole index. It is the aggregate root: entries are reached
// only through it, and it is safe for concurrent tool calls.
type Vocabulary struct {
	mu      sync.RWMutex
	entries map[string]Entry
}

func New() *Vocabulary {
	return &Vocabulary{entries: make(map[string]Entry)}
}

// Put files an entry, replacing any earlier entry for the same topic.
func (v *Vocabulary) Put(entry Entry) Filing {
	v.mu.Lock()
	defer v.mu.Unlock()

	filing := Filing{Entry: entry}

	if previous, exists := v.entries[entry.topic]; exists {
		filing.Replaced = true
		if previous.file != entry.file {
			filing.PreviousFile = previous.file
		}
	}

	for topic, existing := range v.entries {
		if topic != entry.topic && existing.file == entry.file {
			filing.SharedWith = append(filing.SharedWith, topic)
		}
	}
	sort.Strings(filing.SharedWith)

	v.entries[entry.topic] = entry
	return filing
}

// List returns every entry ordered by topic.
func (v *Vocabulary) List() []Entry {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.sortedEntriesLocked(func(Entry) bool { return true })
}

// Lookup returns the entries whose topic, purpose, or file contains query. An
// empty query returns everything, so Lookup answers "where does X live?"
// without the caller needing an exact topic.
func (v *Vocabulary) Lookup(query string) []Entry {
	needle := strings.ToLower(strings.TrimSpace(query))

	v.mu.RLock()
	defer v.mu.RUnlock()

	return v.sortedEntriesLocked(func(entry Entry) bool {
		if needle == "" {
			return true
		}
		return strings.Contains(entry.topic, needle) ||
			strings.Contains(strings.ToLower(entry.purpose), needle) ||
			strings.Contains(strings.ToLower(entry.file), needle)
	})
}

// Drop removes a topic. It reports ErrUnknownTopic rather than succeeding
// silently, so a caller cannot believe it cleaned up something it did not.
func (v *Vocabulary) Drop(topic string) error {
	normalizedTopic := NormalizeTopic(topic)

	v.mu.Lock()
	defer v.mu.Unlock()

	if _, exists := v.entries[normalizedTopic]; !exists {
		return fmt.Errorf("%w: %s", ErrUnknownTopic, normalizedTopic)
	}
	delete(v.entries, normalizedTopic)
	return nil
}

func (v *Vocabulary) Len() int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.entries)
}

func (v *Vocabulary) sortedEntriesLocked(keep func(Entry) bool) []Entry {
	matched := make([]Entry, 0, len(v.entries))
	for _, entry := range v.entries {
		if keep(entry) {
			matched = append(matched, entry)
		}
	}
	sort.Slice(matched, func(i, j int) bool { return matched[i].topic < matched[j].topic })
	return matched
}
