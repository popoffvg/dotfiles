import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";

const AGENTS_DIR = path.resolve(
  process.env.HOME || "~",
  "Documents/git/dotfiles/harness/agents",
);

interface AgentMeta {
  name: string;
  description: string;
  file: string;
  body: string;
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  let currentKey = "";
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      meta[currentKey] = kv[2].replace(/^>\s*$/, "").trim();
    } else if (currentKey && line.match(/^\s+/)) {
      meta[currentKey] = ((meta[currentKey] || "") + " " + line.trim()).trim();
    }
  }
  return { meta, body: match[2] };
}

async function loadAgents(): Promise<AgentMeta[]> {
  let files: string[];
  try {
    files = await fs.readdir(AGENTS_DIR);
  } catch {
    return [];
  }

  const agents: AgentMeta[] = [];
  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const content = await fs.readFile(path.join(AGENTS_DIR, file), "utf8");
    const { meta, body } = parseFrontmatter(content);
    agents.push({
      name: meta.name || path.basename(file, ".md"),
      description: meta.description || "",
      file,
      body: content,
    });
  }
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

export function register(pi: ExtensionAPI) {
  let activeRole: AgentMeta | null = null;

  pi.registerCommand("role", {
    description: "Pick an agent role from harness/agents/ to inject into system prompt",
    handler: async (args, ctx) => {
      const agents = await loadAgents();
      if (!agents.length) {
        ctx.ui.notify(`No agents found in ${AGENTS_DIR}`, "warning");
        return;
      }

      const trimmed = (args ?? "").trim();

      // /role off — clear active role
      if (trimmed === "off" || trimmed === "clear" || trimmed === "none") {
        if (activeRole) {
          const prev = activeRole.name;
          activeRole = null;
          ctx.ui.notify(`Role cleared (was: ${prev})`, "info");
        } else {
          ctx.ui.notify("No active role", "info");
        }
        return;
      }

      // /role <name> — direct pick
      if (trimmed) {
        const match = agents.find(
          (a) => a.name === trimmed || a.file === trimmed || a.file === trimmed + ".md",
        );
        if (match) {
          activeRole = match;
          ctx.ui.notify(`Role set: ${match.name}`, "success");
          return;
        }
        ctx.ui.notify(`Agent "${trimmed}" not found. Available: ${agents.map((a) => a.name).join(", ")}`, "warning");
        return;
      }

      // /role — interactive select
      const options = agents.map((a) => {
        const desc = a.description ? ` — ${a.description}` : "";
        const marker = activeRole?.name === a.name ? " [active]" : "";
        return `${a.name}${marker}${desc}`;
      });
      options.push("(clear role)");

      const choice = await ctx.ui.select("Choose agent role:", options);
      if (!choice) return;

      if (choice === "(clear role)") {
        activeRole = null;
        ctx.ui.notify("Role cleared", "info");
        return;
      }

      const chosenName = choice.split(" — ")[0].replace(" [active]", "").trim();
      const agent = agents.find((a) => a.name === chosenName);
      if (agent) {
        activeRole = agent;
        ctx.ui.notify(`Role set: ${agent.name}`, "success");
      }
    },
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!activeRole) return;

    const section =
      `\n\n## Active Role: ${activeRole.name}\n\n` +
      `You are operating under the following agent role. Follow its instructions.\n\n` +
      activeRole.body;

    return { systemPrompt: event.systemPrompt + section };
  });
}
