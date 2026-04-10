import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_OUTPUT_CHARS = 200_000;

function parseArgs(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    out.push(value.replace(/\\(["'\\])/g, "$1"));
  }
  return out;
}

function hasWildcards(segment: string): boolean {
  return segment.includes("*") || segment.includes("?");
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function existsFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

function isMarkdownFile(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  return ext === ".md" || ext === ".markdown";
}

async function expandPattern(absPattern: string): Promise<string[]> {
  const normalized = path.resolve(absPattern);
  const parsed = path.parse(normalized);
  const withoutRoot = normalized.slice(parsed.root.length);
  const parts = withoutRoot.split(path.sep).filter(Boolean);

  let candidates: string[] = [parsed.root || path.sep];

  for (const part of parts) {
    const next: string[] = [];

    for (const base of candidates) {
      if (hasWildcards(part)) {
        if (!(await isDirectory(base))) continue;
        const entries = await fs.readdir(base, { withFileTypes: true });
        const matcher = globToRegExp(part);
        for (const entry of entries) {
          if (matcher.test(entry.name)) next.push(path.join(base, entry.name));
        }
      } else {
        next.push(path.join(base, part));
      }
    }

    candidates = next;
    if (candidates.length === 0) break;
  }

  const files: string[] = [];
  for (const p of candidates) {
    if ((await existsFile(p)) && isMarkdownFile(p)) files.push(p);
  }

  return files.sort();
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("readmd", {
    description: "Read markdown files: /readmd a.md b.md or /readmd docs/*.md",
    handler: async (args, ctx) => {
      const tokens = parseArgs(args ?? "");
      if (tokens.length === 0) {
        ctx.ui.notify("Usage: /readmd <file1.md> <file2.md> or /readmd <glob>", "warning");
        return;
      }

      const resolved: string[] = [];
      const missing: string[] = [];

      for (const token of tokens) {
        const abs = path.resolve(ctx.cwd, token);

        if (hasWildcards(token)) {
          const expanded = await expandPattern(abs);
          if (expanded.length === 0) missing.push(token);
          resolved.push(...expanded);
          continue;
        }

        if ((await existsFile(abs)) && isMarkdownFile(abs)) {
          resolved.push(abs);
        } else {
          missing.push(token);
        }
      }

      const files = Array.from(new Set(resolved)).sort();
      if (files.length === 0) {
        const suffix = missing.length > 0 ? ` (${missing.join(", ")})` : "";
        ctx.ui.notify(`No markdown files matched${suffix}`, "warning");
        return;
      }

      const chunks: string[] = [];
      for (const file of files) {
        const content = await fs.readFile(file, "utf8");
        chunks.push(`# ${file}\n\n${content.trimEnd()}\n`);
      }

      let output = chunks.join("\n\n---\n\n");
      if (output.length > MAX_OUTPUT_CHARS) {
        output = `${output.slice(0, MAX_OUTPUT_CHARS)}\n\n[Truncated to ${MAX_OUTPUT_CHARS} characters]`;
      }

      await ctx.ui.editor(`readmd (${files.length} files)`, output);

      if (missing.length > 0) {
        ctx.ui.notify(`Skipped ${missing.length} path(s): ${missing.join(", ")}`, "warning");
      }
    },
  });
}
