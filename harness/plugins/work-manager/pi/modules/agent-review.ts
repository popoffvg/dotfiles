/**
 * Agent Review — pi module.
 *
 * Registers:
 *   - A guard hook that blocks direct edits/writes to .vscode/agent-comments.json.
 *   - comment_update_status / comment_get / comment_list tools to manage comment state.
 *
 * Absorbed into work-manager from the former standalone agent-review plugin.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";

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

function commentsPath(cwd: string): string {
  return path.join(cwd, ".vscode", "agent-comments.json");
}

function readComments(cwd: string): CommentsFile | null {
  const p = commentsPath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeComments(cwd: string, data: CommentsFile): void {
  const p = commentsPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

export function register(pi: ExtensionAPI) {
  // --- Guard: block direct edits to agent-comments.json ---

  pi.on("tool_call", async (event) => {
    if (!["edit", "write"].includes(event.toolName)) return;

    const filePath = (event.input as Record<string, unknown>)?.file_path;
    if (typeof filePath !== "string") return;

    if (filePath.endsWith("agent-comments.json")) {
      return {
        block: true,
        reason:
          "Direct edits to .vscode/agent-comments.json are not allowed. Use the comment_update_status tool to change comment status.",
      };
    }
  });

  // --- Tool: comment_update_status ---

  pi.registerTool({
    name: "comment_update_status",
    label: "Comment Update Status",
    description:
      "Update status of a comment in .vscode/agent-comments.json. Use this instead of editing the file directly.",
    parameters: Type.Object({
      id: Type.String({ description: "Comment UUID to update" }),
      status: Type.Union(
        [
          Type.Literal("pending"),
          Type.Literal("applied"),
          Type.Literal("failed"),
          Type.Literal("skipped"),
        ],
        { description: "New status" },
      ),
      lastError: Type.Optional(
        Type.String({ description: "Error reason (required when status=failed)" }),
      ),
      resolved: Type.Optional(
        Type.Boolean({ description: "Mark comment as resolved" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      const data = readComments(cwd);
      if (!data) {
        return {
          content: [{ type: "text" as const, text: "No .vscode/agent-comments.json found." }],
        };
      }

      const comment = data.comments.find((c) => c.id === params.id);
      if (!comment) {
        return {
          content: [{ type: "text" as const, text: `Comment with id "${params.id}" not found.` }],
        };
      }

      comment.status = params.status;
      if (params.lastError !== undefined) {
        comment.lastError = params.lastError;
      }
      if (params.resolved !== undefined) {
        comment.resolved = params.resolved;
      }

      writeComments(cwd, data);

      return {
        content: [
          {
            type: "text" as const,
            text: `Comment ${params.id} updated: status=${params.status}${params.lastError ? `, lastError="${params.lastError}"` : ""}${params.resolved !== undefined ? `, resolved=${params.resolved}` : ""}`,
          },
        ],
      };
    },
  });

  // --- Tool: comment_get ---

  pi.registerTool({
    name: "comment_get",
    label: "Comment Get",
    description: "Get full details of a single comment by ID.",
    parameters: Type.Object({
      id: Type.String({ description: "Comment UUID" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      const data = readComments(cwd);
      if (!data) {
        return {
          content: [{ type: "text" as const, text: "No .vscode/agent-comments.json found." }],
        };
      }

      const comment = data.comments.find((c) => c.id === params.id);
      if (!comment) {
        return {
          content: [{ type: "text" as const, text: `Comment with id "${params.id}" not found.` }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(comment, null, 2) }],
      };
    },
  });

  // --- Tool: comment_list ---

  pi.registerTool({
    name: "comment_list",
    label: "Comment List",
    description:
      "List comments from .vscode/agent-comments.json, optionally filtered by status.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.Union(
          [
            Type.Literal("pending"),
            Type.Literal("applied"),
            Type.Literal("failed"),
            Type.Literal("skipped"),
            Type.Literal("all"),
          ],
          { description: "Filter by status (default: all)" },
        ),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      const data = readComments(cwd);
      if (!data) {
        return {
          content: [{ type: "text" as const, text: "No .vscode/agent-comments.json found." }],
        };
      }

      const filtered =
        !params.status || params.status === "all"
          ? data.comments
          : data.comments.filter((c) => c.status === params.status);

      const summary = filtered.map((c) => ({
        id: c.id,
        status: c.status,
        file: c.absPath,
        line: c.line,
        text: c.text.slice(0, 80),
        ...(c.lastError ? { lastError: c.lastError } : {}),
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  });
}
