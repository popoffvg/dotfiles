/**
 * Comment Guard MCP Server.
 *
 * Provides a tool to update comment status in .vscode/agent-comments.json.
 * Direct file edits are blocked by the companion hook — use this tool instead.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import * as fs from "node:fs";
import * as path from "node:path";

const CWD = process.env.WORK_CWD || process.cwd();

interface Comment {
  id: string;
  absPath: string;
  line: number;
  text: string;
  status: string;
  resolved?: boolean;
  lastError?: string;
  [key: string]: unknown;
}

interface CommentsFile {
  version: number;
  comments: Comment[];
}

function commentsPath(): string {
  return path.join(CWD, ".vscode", "agent-comments.json");
}

function readComments(): CommentsFile | null {
  const p = commentsPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeComments(data: CommentsFile): void {
  const p = commentsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

// --- MCP Server ---

const server = new McpServer({
  name: "agent-review",
  version: "1.0.0",
});

server.tool(
  "comment_update_status",
  "Update status of a comment in .vscode/agent-comments.json. Use this instead of editing the file directly.",
  {
    id: z.string().describe("Comment UUID to update"),
    status: z
      .enum(["pending", "applied", "failed", "skipped"])
      .describe("New status"),
    lastError: z
      .string()
      .optional()
      .describe("Error reason (required when status=failed)"),
    resolved: z
      .boolean()
      .optional()
      .describe("Mark comment as resolved"),
  },
  async ({ id, status, lastError, resolved }) => {
    const data = readComments();
    if (!data) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No .vscode/agent-comments.json found.",
          },
        ],
      };
    }

    const comment = data.comments.find((c) => c.id === id);
    if (!comment) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Comment with id "${id}" not found.`,
          },
        ],
      };
    }

    comment.status = status;
    if (lastError !== undefined) {
      comment.lastError = lastError;
    }
    if (resolved !== undefined) {
      comment.resolved = resolved;
    }

    writeComments(data);

    return {
      content: [
        {
          type: "text" as const,
          text: `Comment ${id} updated: status=${status}${lastError ? `, lastError="${lastError}"` : ""}${resolved !== undefined ? `, resolved=${resolved}` : ""}`,
        },
      ],
    };
  },
);

server.tool(
  "comment_list",
  "List comments from .vscode/agent-comments.json, optionally filtered by status.",
  {
    status: z
      .enum(["pending", "applied", "failed", "skipped", "all"])
      .optional()
      .describe("Filter by status (default: all)"),
  },
  async ({ status }) => {
    const data = readComments();
    if (!data) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No .vscode/agent-comments.json found.",
          },
        ],
      };
    }

    const filtered =
      !status || status === "all"
        ? data.comments
        : data.comments.filter((c) => c.status === status);

    const summary = filtered.map((c) => ({
      id: c.id,
      status: c.status,
      file: c.absPath,
      line: c.line,
      text: c.text.slice(0, 80),
      ...(c.lastError ? { lastError: c.lastError } : {}),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "comment_get",
  "Get full details of a single comment by ID.",
  {
    id: z.string().describe("Comment UUID"),
  },
  async ({ id }) => {
    const data = readComments();
    if (!data) {
      return {
        content: [
          { type: "text" as const, text: "No .vscode/agent-comments.json found." },
        ],
      };
    }

    const comment = data.comments.find((c) => c.id === id);
    if (!comment) {
      return {
        content: [
          { type: "text" as const, text: `Comment with id "${id}" not found.` },
        ],
      };
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(comment, null, 2) },
      ],
    };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Agent Review MCP server failed:", err);
  process.exit(1);
});
