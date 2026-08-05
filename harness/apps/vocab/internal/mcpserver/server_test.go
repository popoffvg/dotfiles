package mcpserver

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/popoffvg/dotfiles/harness/apps/vocab/internal/vocabulary"
)

// rpcReply is the slice of a JSON-RPC reply these tests assert on. Driving the
// tools through HandleMessage exercises the declared tool schemas too, not just
// the handler bodies.
type rpcReply struct {
	Result struct {
		IsError bool `json:"isError"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"result"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func callTool(t *testing.T, index *vocabulary.Vocabulary, name string, arguments map[string]any) rpcReply {
	t.Helper()

	srv := NewWith(index, "test")
	request := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params":  map[string]any{"name": name, "arguments": arguments},
	}
	encodedRequest, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	encodedReply, err := json.Marshal(srv.HandleMessage(context.Background(), encodedRequest))
	if err != nil {
		t.Fatalf("marshal reply: %v", err)
	}

	var reply rpcReply
	if err := json.Unmarshal(encodedReply, &reply); err != nil {
		t.Fatalf("unmarshal reply %s: %v", encodedReply, err)
	}
	if reply.Error != nil {
		t.Fatalf("tools/call %s returned protocol error: %s", name, reply.Error.Message)
	}
	if len(reply.Result.Content) == 0 {
		t.Fatalf("tools/call %s returned no content: %s", name, encodedReply)
	}
	return reply
}

func payloadOf(t *testing.T, reply rpcReply) map[string]any {
	t.Helper()
	if reply.Result.IsError {
		t.Fatalf("tool reported an error: %s", reply.Result.Content[0].Text)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(reply.Result.Content[0].Text), &payload); err != nil {
		t.Fatalf("tool text is not JSON (%s): %v", reply.Result.Content[0].Text, err)
	}
	return payload
}

func entryArg(topic, file, purpose string) map[string]any {
	return map[string]any{"topic": topic, "file": file, "purpose": purpose}
}

func TestToolsAreRegistered(t *testing.T) {
	srv := New("test")
	request, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0", "id": 1, "method": "tools/list",
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	encodedReply, err := json.Marshal(srv.HandleMessage(context.Background(), request))
	if err != nil {
		t.Fatalf("marshal reply: %v", err)
	}

	for _, name := range []string{"vocab_put", "vocab_lookup", "vocab_list", "vocab_drop"} {
		if !strings.Contains(string(encodedReply), `"`+name+`"`) {
			t.Errorf("tools/list is missing %s: %s", name, encodedReply)
		}
	}
}

func TestPutFilesSeveralTopicsInOneCall(t *testing.T) {
	index := vocabulary.New()
	reply := callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{
			entryArg("GitHub Repo Settings", "/repo/gh.md", "repo settings"),
			entryArg("mise tasks", "/repo/.mise.toml", "build and stow tasks"),
		},
	})

	payload := payloadOf(t, reply)
	filed, ok := payload["filed"].([]any)
	if !ok || len(filed) != 2 {
		t.Fatalf("filed = %v, want 2 entries", payload["filed"])
	}
	if got, want := payload["total_topics"], float64(2); got != want {
		t.Errorf("total_topics = %v, want %v", got, want)
	}

	first := filed[0].(map[string]any)
	if got, want := first["topic"], "github-repo-settings"; got != want {
		t.Errorf("topic = %v, want %v — the boundary must normalize like the domain", got, want)
	}
	if got, want := first["status"], "filed"; got != want {
		t.Errorf("status = %v, want %v", got, want)
	}
}

func TestPutRejectsRelativePathButKeepsTheValidEntry(t *testing.T) {
	index := vocabulary.New()
	reply := callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{
			entryArg("good", "/repo/good.md", "fine"),
			entryArg("bad", "relative/path.md", "not absolute"),
		},
	})

	payload := payloadOf(t, reply)
	if filed := payload["filed"].([]any); len(filed) != 1 {
		t.Errorf("filed = %v, want only the valid entry", filed)
	}
	failed, ok := payload["failed"].([]any)
	if !ok || len(failed) != 1 {
		t.Fatalf("failed = %v, want the relative-path entry", payload["failed"])
	}
	if reason := failed[0].(map[string]any)["error"].(string); !strings.Contains(reason, "absolute") {
		t.Errorf("error = %q, want it to name the absolute-path rule", reason)
	}
}

func TestPutWithNoValidEntryIsAToolError(t *testing.T) {
	index := vocabulary.New()
	reply := callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("topic", "/repo/f.md", "   ")},
	})

	if !reply.Result.IsError {
		t.Fatalf("isError = false, want true when every entry was rejected")
	}
	if got := reply.Result.Content[0].Text; !strings.Contains(got, "purpose") {
		t.Errorf("error text = %q, want it to name the failing field", got)
	}
	if got, want := index.Len(), 0; got != want {
		t.Errorf("Len() = %d, want %d", got, want)
	}
}

func TestPutMissingEntriesIsAToolError(t *testing.T) {
	reply := callTool(t, vocabulary.New(), "vocab_put", map[string]any{})
	if !reply.Result.IsError {
		t.Fatalf("isError = false, want true when entries is absent")
	}
}

func TestPutWarnsWhenOneFileCollectsTopics(t *testing.T) {
	index := vocabulary.New()
	callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{
			entryArg("ci-secrets", "/repo/everything.md", "ci secrets"),
			entryArg("branch-rules", "/repo/everything.md", "branch rules"),
		},
	})
	reply := callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("release-flow", "/repo/everything.md", "release flow")},
	})

	filing := payloadOf(t, reply)["filed"].([]any)[0].(map[string]any)

	sharedWith, ok := filing["shared_with"].([]any)
	if !ok || len(sharedWith) != 2 {
		t.Fatalf("shared_with = %v, want the 2 topics already on that file", filing["shared_with"])
	}
	warning, ok := filing["warning"].(string)
	if !ok || !strings.Contains(warning, "3 topics") {
		t.Errorf("warning = %v, want it to count all 3 topics on the file", filing["warning"])
	}
}

func TestPutOmitsWarningForASecondTopicOnAFile(t *testing.T) {
	index := vocabulary.New()
	callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("first", "/repo/shared.md", "first")},
	})
	reply := callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("second", "/repo/shared.md", "second")},
	})

	filing := payloadOf(t, reply)["filed"].([]any)[0].(map[string]any)
	if _, present := filing["warning"]; present {
		t.Errorf("warning = %v, want none — two topics on one file is still reuse", filing["warning"])
	}
}

func TestPutReportsRefilingWithPreviousFile(t *testing.T) {
	index := vocabulary.New()
	callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("github-repo", "/repo/old.md", "repo settings")},
	})
	reply := callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("github-repo", "/repo/new.md", "repo settings")},
	})

	filing := payloadOf(t, reply)["filed"].([]any)[0].(map[string]any)
	if got, want := filing["status"], "refiled"; got != want {
		t.Errorf("status = %v, want %v", got, want)
	}
	if got, want := filing["previous_file"], "/repo/old.md"; got != want {
		t.Errorf("previous_file = %v, want %v", got, want)
	}
}

func TestLookupFindsByPurpose(t *testing.T) {
	index := vocabulary.New()
	callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("github-repo", "/repo/gh.md", "branch protection rules")},
	})

	payload := payloadOf(t, callTool(t, index, "vocab_lookup", map[string]any{"query": "branch protection"}))
	entries := payload["entries"].([]any)
	if len(entries) != 1 {
		t.Fatalf("entries = %v, want 1 match", entries)
	}
	if got, want := entries[0].(map[string]any)["file"], "/repo/gh.md"; got != want {
		t.Errorf("file = %v, want %v", got, want)
	}
}

func TestLookupMissWithoutMatchReturnsHint(t *testing.T) {
	payload := payloadOf(t, callTool(t, vocabulary.New(), "vocab_lookup", map[string]any{"query": "absent"}))
	if entries := payload["entries"].([]any); len(entries) != 0 {
		t.Errorf("entries = %v, want empty", entries)
	}
	hint, ok := payload["hint"].(string)
	if !ok || hint == "" {
		t.Error("hint is empty, want guidance on what to do after a miss")
	}
}

func TestListReturnsEverySortedTopic(t *testing.T) {
	index := vocabulary.New()
	callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{
			entryArg("zeta", "/repo/z.md", "z"),
			entryArg("alpha", "/repo/a.md", "a"),
		},
	})

	entries := payloadOf(t, callTool(t, index, "vocab_list", map[string]any{}))["entries"].([]any)
	if len(entries) != 2 {
		t.Fatalf("entries = %v, want 2", entries)
	}
	if got, want := entries[0].(map[string]any)["topic"], "alpha"; got != want {
		t.Errorf("first topic = %v, want %v", got, want)
	}
}

func TestListOnEmptyIndexExplainsItStartsEmpty(t *testing.T) {
	payload := payloadOf(t, callTool(t, vocabulary.New(), "vocab_list", map[string]any{}))
	if got, want := payload["total_topics"], float64(0); got != want {
		t.Errorf("total_topics = %v, want %v", got, want)
	}
	hint, ok := payload["hint"].(string)
	if !ok || !strings.Contains(hint, "empty every session") {
		t.Errorf("hint = %v, want it to state the index is per-session", payload["hint"])
	}
}

func TestDropRemovesTopic(t *testing.T) {
	index := vocabulary.New()
	callTool(t, index, "vocab_put", map[string]any{
		"entries": []any{entryArg("github-repo", "/repo/gh.md", "repo settings")},
	})

	payload := payloadOf(t, callTool(t, index, "vocab_drop", map[string]any{"topic": "GitHub Repo"}))
	if got, want := payload["dropped_topic"], "github-repo"; got != want {
		t.Errorf("dropped_topic = %v, want %v", got, want)
	}
	if got, want := index.Len(), 0; got != want {
		t.Errorf("Len() = %d, want %d", got, want)
	}
}

func TestDropUnknownTopicIsAToolError(t *testing.T) {
	reply := callTool(t, vocabulary.New(), "vocab_drop", map[string]any{"topic": "absent"})
	if !reply.Result.IsError {
		t.Fatal("isError = false, want true for an unknown topic")
	}
}

func TestDropBlankTopicIsAToolError(t *testing.T) {
	reply := callTool(t, vocabulary.New(), "vocab_drop", map[string]any{"topic": "   "})
	if !reply.Result.IsError {
		t.Fatal("isError = false, want true for a blank topic")
	}
}
