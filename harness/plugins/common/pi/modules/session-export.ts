import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";

interface ExportedEntry {
  index: number;
  type: string;
  role?: string;
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  customType?: string;
  data?: unknown;
}

function extractEntry(entry: any, index: number): ExportedEntry {
  const out: ExportedEntry = { index, type: entry.type };

  if (entry.type === "message" && entry.message) {
    const msg = entry.message;
    out.role = msg.role;

    if (typeof msg.content === "string") {
      out.content = msg.content;
    } else if (Array.isArray(msg.content)) {
      const texts = msg.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text);
      if (texts.length) out.content = texts.join("\n");

      const toolUses = msg.content.filter((b: any) => b.type === "tool_use");
      if (toolUses.length === 1) {
        out.toolName = toolUses[0].name;
        out.toolArgs = toolUses[0].input;
      } else if (toolUses.length > 1) {
        out.data = toolUses.map((t: any) => ({
          toolName: t.name,
          toolArgs: t.input,
        }));
      }

      const toolResults = msg.content.filter((b: any) => b.type === "tool_result");
      if (toolResults.length === 1) {
        out.toolResult = toolResults[0].content;
      } else if (toolResults.length > 1) {
        out.toolResult = toolResults.map((t: any) => t.content);
      }
    }
  } else if (entry.type === "custom" || entry.type === "custom_message") {
    out.customType = entry.customType;
    out.data = entry.data;
  }

  return out;
}

export function register(pi: ExtensionAPI) {
  pi.registerCommand("session-export", {
    description: "Export current session to JSON: /session-export [filename]",
    handler: async (args, ctx) => {
      const entries = ctx.sessionManager.getBranch();
      if (!entries.length) {
        ctx.ui.notify("Session is empty — nothing to export", "warning");
        return;
      }

      const exported = entries.map((e, i) => extractEntry(e, i));

      const sessionName = ctx.sessionManager.getSessionName?.() ?? "unnamed";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const defaultName = `session-${sessionName}-${timestamp}.json`;

      const filename = (args ?? "").trim() || defaultName;
      const outPath = path.resolve(ctx.cwd, filename);

      const json = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          sessionName,
          entryCount: exported.length,
          entries: exported,
        },
        null,
        2,
      );

      await fs.writeFile(outPath, json, "utf8");
      ctx.ui.notify(`Exported ${exported.length} entries → ${outPath}`, "success");
    },
  });

  pi.registerCommand("session-export-text", {
    description: "Export session as readable text: /session-export-text [filename]",
    handler: async (args, ctx) => {
      const entries = ctx.sessionManager.getBranch();
      if (!entries.length) {
        ctx.ui.notify("Session is empty — nothing to export", "warning");
        return;
      }

      const lines: string[] = [];
      for (const entry of entries) {
        if (entry.type !== "message" || !entry.message) continue;
        const msg = entry.message;
        const role = msg.role === "user" ? "User" : "Assistant";

        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = msg.content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("\n");
        }

        if (text && !text.startsWith("<")) {
          lines.push(`## ${role}\n\n${text.trim()}\n`);
        }
      }

      if (!lines.length) {
        ctx.ui.notify("No readable messages found", "warning");
        return;
      }

      const sessionName = ctx.sessionManager.getSessionName?.() ?? "unnamed";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const defaultName = `session-${sessionName}-${timestamp}.md`;

      const filename = (args ?? "").trim() || defaultName;
      const outPath = path.resolve(ctx.cwd, filename);

      const header = `# Session Export: ${sessionName}\n\nExported: ${new Date().toISOString()}\n\n---\n\n`;
      await fs.writeFile(outPath, header + lines.join("\n---\n\n"), "utf8");
      ctx.ui.notify(`Exported ${lines.length} messages → ${outPath}`, "success");
    },
  });
}
