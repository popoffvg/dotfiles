// Package mcpserver exposes the vocabulary over MCP. It owns the boundary: it
// maps request arguments into vocabulary entries and maps entries back into
// JSON payloads. No vocabulary rule lives here.
package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/popoffvg/dotfiles/harness/apps/vocab/internal/vocabulary"
)

const instructions = `The vocabulary is a topic index: one topic points at the one file that carries the truth for it.

It starts EMPTY every session and is never written to disk. You fill it as you work, so later steps can find the one place a fact already lives instead of writing a second copy.

- vocab_lookup BEFORE writing a fact anywhere. If a topic already has a file, edit that file or reference it.
- vocab_put AFTER reading a file — name the topic or topics that file is the truth for.
- vocab_put tells you which other topics already point at the same file. Two or three is a file doing several jobs: split it.`

// entryDTO is the wire shape of one entry. Public fields, no behavior.
type entryDTO struct {
	Topic   string `json:"topic"`
	File    string `json:"file"`
	Purpose string `json:"purpose"`
}

// filingDTO reports what one vocab_put changed.
type filingDTO struct {
	Topic        string   `json:"topic"`
	File         string   `json:"file"`
	Status       string   `json:"status"`
	PreviousFile string   `json:"previous_file,omitempty"`
	SharedWith   []string `json:"shared_with,omitempty"`
	Warning      string   `json:"warning,omitempty"`
	Error        string   `json:"error,omitempty"`
}

type putResultDTO struct {
	Filed  []filingDTO `json:"filed"`
	Failed []filingDTO `json:"failed,omitempty"`
	Total  int         `json:"total_topics"`
}

type listResultDTO struct {
	Entries []entryDTO `json:"entries"`
	Total   int        `json:"total_topics"`
	Hint    string     `json:"hint,omitempty"`
}

type dropResultDTO struct {
	Topic   string `json:"dropped_topic"`
	Total   int    `json:"total_topics"`
	Dropped bool   `json:"dropped"`
}

// sharedFileThreshold is the point at which one file holding N topics stops
// looking like reuse and starts looking like the dumping ground the index
// exists to prevent.
const sharedFileThreshold = 2

// New builds the MCP server over a fresh, empty vocabulary.
func New(version string) *server.MCPServer {
	return NewWith(vocabulary.New(), version)
}

// NewWith builds the MCP server over an existing vocabulary. Tests use it to
// inspect the index the tools mutate.
func NewWith(index *vocabulary.Vocabulary, version string) *server.MCPServer {
	srv := server.NewMCPServer(
		"vocab",
		version,
		server.WithToolCapabilities(true),
		server.WithInstructions(instructions),
	)
	registerTools(srv, index)
	return srv
}

func registerTools(srv *server.MCPServer, index *vocabulary.Vocabulary) {
	srv.AddTool(
		mcp.NewTool("vocab_put",
			mcp.WithTitleAnnotation("File Topics"),
			mcp.WithReadOnlyHintAnnotation(false),
			mcp.WithDestructiveHintAnnotation(false),
			mcp.WithIdempotentHintAnnotation(true),
			mcp.WithOpenWorldHintAnnotation(false),
			mcp.WithDescription(`Bind topics to the file that carries their truth. Call this after reading any file — name every topic that file is authoritative for.

Send several entries in one call. Re-filing a topic replaces its file. The reply names the other topics already pointing at the same file, so you can see when one file is absorbing everything.`),
			mcp.WithArray("entries",
				mcp.Required(),
				mcp.Description("One or more topic bindings."),
				mcp.Items(map[string]any{
					"type":     "object",
					"required": []string{"topic", "file", "purpose"},
					"properties": map[string]any{
						"topic": map[string]any{
							"type":        "string",
							"description": "The concept, folded to lowercase kebab-case (e.g. github-repo-settings).",
						},
						"file": map[string]any{
							"type":        "string",
							"description": "Absolute path of the file that carries the truth for this topic.",
						},
						"purpose": map[string]any{
							"type":        "string",
							"description": "One line: what this file is authoritative for.",
						},
					},
				}),
			),
		),
		handlePut(index),
	)

	srv.AddTool(
		mcp.NewTool("vocab_lookup",
			mcp.WithTitleAnnotation("Look Up Topic"),
			mcp.WithReadOnlyHintAnnotation(true),
			mcp.WithDestructiveHintAnnotation(false),
			mcp.WithIdempotentHintAnnotation(true),
			mcp.WithOpenWorldHintAnnotation(false),
			mcp.WithDescription(`Find where a topic's truth already lives. Call this BEFORE writing a fact into any file — if the topic is already bound, edit that file or reference it instead of writing a second copy.

Matches the query against topic, purpose, and file path. Blank query returns everything.`),
			mcp.WithString("query",
				mcp.Description("Topic, keyword, or path fragment."),
			),
		),
		handleLookup(index),
	)

	srv.AddTool(
		mcp.NewTool("vocab_list",
			mcp.WithTitleAnnotation("List Vocabulary"),
			mcp.WithReadOnlyHintAnnotation(true),
			mcp.WithDestructiveHintAnnotation(false),
			mcp.WithIdempotentHintAnnotation(true),
			mcp.WithOpenWorldHintAnnotation(false),
			mcp.WithDescription("List every topic filed this session with its file and purpose."),
		),
		handleList(index),
	)

	srv.AddTool(
		mcp.NewTool("vocab_drop",
			mcp.WithTitleAnnotation("Drop Topic"),
			mcp.WithReadOnlyHintAnnotation(false),
			mcp.WithDestructiveHintAnnotation(true),
			mcp.WithIdempotentHintAnnotation(false),
			mcp.WithOpenWorldHintAnnotation(false),
			mcp.WithDescription("Remove a topic from the index — use it when the binding turned out wrong, not to tidy up."),
			mcp.WithString("topic",
				mcp.Required(),
				mcp.Description("The topic to remove."),
			),
		),
		handleDrop(index),
	)
}

func handlePut(index *vocabulary.Vocabulary) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		rawEntries, ok := request.GetArguments()["entries"].([]any)
		if !ok || len(rawEntries) == 0 {
			return mcp.NewToolResultError("entries is required and must be a non-empty array of {topic, file, purpose}"), nil
		}

		result := putResultDTO{}
		for _, rawEntry := range rawEntries {
			fields, ok := rawEntry.(map[string]any)
			if !ok {
				result.Failed = append(result.Failed, filingDTO{
					Status: "rejected",
					Error:  "entry must be an object with topic, file, and purpose",
				})
				continue
			}

			topic, _ := fields["topic"].(string)
			file, _ := fields["file"].(string)
			purpose, _ := fields["purpose"].(string)

			entry, err := vocabulary.NewEntry(topic, file, purpose)
			if err != nil {
				result.Failed = append(result.Failed, filingDTO{
					Topic:  topic,
					File:   file,
					Status: "rejected",
					Error:  err.Error(),
				})
				continue
			}

			result.Filed = append(result.Filed, toFilingDTO(index.Put(entry)))
		}

		result.Total = index.Len()
		if len(result.Filed) == 0 {
			return mcp.NewToolResultError("no entry was accepted: " + summarizeFailures(result.Failed)), nil
		}
		return jsonResult(result)
	}
}

func handleLookup(index *vocabulary.Vocabulary) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		query, _ := request.GetArguments()["query"].(string)
		found := index.Lookup(query)

		result := listResultDTO{Entries: toEntryDTOs(found), Total: index.Len()}
		if len(found) == 0 {
			result.Hint = "No topic bound yet. This file may be the first place this fact lives — write it, then vocab_put the topic."
		}
		return jsonResult(result)
	}
}

func handleList(index *vocabulary.Vocabulary) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		entries := index.List()
		result := listResultDTO{Entries: toEntryDTOs(entries), Total: len(entries)}
		if len(entries) == 0 {
			result.Hint = "The index is empty — it starts empty every session. vocab_put a topic after reading a file."
		}
		return jsonResult(result)
	}
}

func handleDrop(index *vocabulary.Vocabulary) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		topic, _ := request.GetArguments()["topic"].(string)
		if strings.TrimSpace(topic) == "" {
			return mcp.NewToolResultError("topic is required"), nil
		}
		if err := index.Drop(topic); err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return jsonResult(dropResultDTO{
			Topic:   vocabulary.NormalizeTopic(topic),
			Total:   index.Len(),
			Dropped: true,
		})
	}
}

func toFilingDTO(filing vocabulary.Filing) filingDTO {
	dto := filingDTO{
		Topic:        filing.Entry.Topic(),
		File:         filing.Entry.File(),
		Status:       "filed",
		PreviousFile: filing.PreviousFile,
		SharedWith:   filing.SharedWith,
	}
	if filing.Replaced {
		dto.Status = "refiled"
	}
	if len(filing.SharedWith) >= sharedFileThreshold {
		dto.Warning = fmt.Sprintf("%s now carries %d topics. Split it — one file per purpose.",
			filing.Entry.File(), len(filing.SharedWith)+1)
	}
	return dto
}

func toEntryDTOs(entries []vocabulary.Entry) []entryDTO {
	dtos := make([]entryDTO, 0, len(entries))
	for _, entry := range entries {
		dtos = append(dtos, entryDTO{
			Topic:   entry.Topic(),
			File:    entry.File(),
			Purpose: entry.Purpose(),
		})
	}
	return dtos
}

func summarizeFailures(failures []filingDTO) string {
	reasons := make([]string, 0, len(failures))
	for _, failure := range failures {
		reasons = append(reasons, failure.Error)
	}
	return strings.Join(reasons, "; ")
}

func jsonResult(payload any) (*mcp.CallToolResult, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return mcp.NewToolResultError("failed to encode result: " + err.Error()), nil
	}
	return mcp.NewToolResultText(string(encoded)), nil
}
