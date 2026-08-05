// Command vocab-mcp serves the topic index over MCP on stdio.
//
// Claude Code spawns one process per session, so the index starts empty and
// dies with the session. That is deliberate: it routes work inside a session,
// it does not accumulate across them.
package main

import (
	"fmt"
	"os"

	"github.com/mark3labs/mcp-go/server"

	"github.com/popoffvg/dotfiles/harness/apps/vocab/internal/mcpserver"
)

// version is overridden at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-v") {
		fmt.Println(version)
		return
	}

	if err := server.ServeStdio(mcpserver.New(version)); err != nil {
		fmt.Fprintf(os.Stderr, "vocab-mcp: %v\n", err)
		os.Exit(1)
	}
}
