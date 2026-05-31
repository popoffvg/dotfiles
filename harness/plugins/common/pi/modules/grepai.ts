/**
 * GrepAI Extension
 *
 * Registers semantic code search and call-trace tools backed by the `grepai` CLI.
 * Supports both single-project (local .grepai/) and workspace modes.
 *
 * Configuration via environment variables:
 *   GREPAI_WORKSPACE  — workspace name for cross-project search (e.g. "mil")
 *   GREPAI_PROJECT    — default workspace project (e.g. "pl")
 *
 * If env vars are missing, falls back to GREPAI_* keys from nearest .mise.toml.
 *
 * Tools are only registered when grepai is available (binary on PATH) AND
 * either a .grepai/ folder exists in cwd or GREPAI_WORKSPACE is set.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function grepaiAvailable(): boolean {
	try {
		execSync("which grepai", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function hasLocalIndex(cwd: string): boolean {
	return existsSync(join(cwd, ".grepai"));
}

function run(args: string[], cwd: string, timeoutMs = 30_000): string {
	return execFileSync("grepai", args, {
		cwd,
		timeout: timeoutMs,
		maxBuffer: 512 * 1024,
		encoding: "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
	});
}

function collapseOutput(raw: string, maxLines = 220, maxChars = 24_000): string {
	const text = raw.trimEnd();
	if (!text) return text;

	const lines = text.split("\n");
	const withinLines = lines.length <= maxLines;
	const withinChars = text.length <= maxChars;
	if (withinLines && withinChars) return text;

	let cut = lines.slice(0, maxLines).join("\n");
	if (cut.length > maxChars) cut = cut.slice(0, maxChars);

	const omittedLines = Math.max(0, lines.length - cut.split("\n").length);
	const omittedChars = Math.max(0, text.length - cut.length);

	return `${cut}\n\n[grepai output collapsed: omitted ${omittedLines} lines, ${omittedChars} chars]`;
}

function findNearestMiseToml(startDir: string): string | undefined {
	let dir = startDir;
	while (true) {
		const candidate = join(dir, ".mise.toml");
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

function readGrepaiEnvFromMise(startDir: string): { workspace: string; project: string } {
	const file = findNearestMiseToml(startDir);
	if (!file) return { workspace: "", project: "" };

	try {
		const content = readFileSync(file, "utf-8");
		const ws = content.match(/^\s*GREPAI_WORKSPACE\s*=\s*"([^"]+)"/m)?.[1]?.trim() ?? "";
		const project = content.match(/^\s*GREPAI_PROJECT\s*=\s*"([^"]+)"/m)?.[1]?.trim() ?? "";
		return { workspace: ws, project };
	} catch {
		return { workspace: "", project: "" };
	}
}

export function register(pi: ExtensionAPI) {
	const cwd = process.cwd();
	const miseEnv = readGrepaiEnvFromMise(cwd);
	const workspace = process.env.GREPAI_WORKSPACE?.trim() || miseEnv.workspace;
	const defaultProject = process.env.GREPAI_PROJECT?.trim() || miseEnv.project;

	if (!grepaiAvailable()) return;

	const localIndex = hasLocalIndex(cwd);
	if (!localIndex && !workspace) return;

	function wsFlags(project?: string): string[] {
		if (!workspace) return [];
		const flags = ["--workspace", workspace];
		const resolvedProject = project?.trim() || defaultProject;
		if (resolvedProject) flags.push("--project", resolvedProject);
		return flags;
	}

	// ── grepai_search ──────────────────────────────────────────────────────
	pi.registerTool({
		name: "grepai_search",
		label: "GrepAI Search",
		description:
			"Semantic code search — find code by meaning, not just exact text. " +
			"Returns ranked results with file paths, line numbers, and content. " +
			(workspace
				? (defaultProject
					? `Workspace "${workspace}" is active; default project is "${defaultProject}" (override with \`project\`).`
					: `Workspace "${workspace}" is active; use \`project\` to narrow to a specific repo.`)
				: "Searches the local project index."),
		parameters: Type.Object({
			query: Type.String({ description: "Natural language search query" }),
			limit: Type.Optional(
				Type.Number({ description: "Max results to return (default: 10)", default: 10 })
			),
			project: Type.Optional(
				Type.String({
					description: workspace
						? (defaultProject
							? `Project name within workspace (default: ${defaultProject})`
							: "Project name within workspace to narrow search (e.g. 'pl', 'platforma')")
						: "Not applicable — no workspace configured",
				})
			),
			path: Type.Optional(
				Type.String({ description: "Path prefix filter (e.g. 'controllers/')" })
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			const args = ["search", params.query, "--toon", "-n", String(params.limit ?? 10)];
			args.push(...wsFlags(params.project));
			if (params.path) args.push("--path", params.path);

			const output = run(args, ctx.cwd);
			return { content: [{ type: "text", text: collapseOutput(output) }] };
		},
	});

	// ── grepai_trace_callers ───────────────────────────────────────────────
	pi.registerTool({
		name: "grepai_trace_callers",
		label: "GrepAI Trace Callers",
		description:
			"Find all functions that call the specified symbol. " +
			"Use before refactoring to understand impact.",
		parameters: Type.Object({
			symbol: Type.String({ description: "Function/method name to find callers of" }),
			mode: Type.Optional(
				Type.String({
					description: "Extraction mode: 'fast' (regex, default) or 'precise' (tree-sitter)",
					default: "fast",
				})
			),
			project: Type.Optional(
				Type.String({ description: "Project name within workspace" })
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			const args = ["trace", "callers", params.symbol, "--toon", "-m", params.mode ?? "fast"];
			args.push(...wsFlags(params.project));

			const output = run(args, ctx.cwd, 60_000);
			return { content: [{ type: "text", text: collapseOutput(output) }] };
		},
	});

	// ── grepai_trace_callees ───────────────────────────────────────────────
	pi.registerTool({
		name: "grepai_trace_callees",
		label: "GrepAI Trace Callees",
		description:
			"Find all functions called by the specified symbol. " +
			"Use to understand what a function depends on.",
		parameters: Type.Object({
			symbol: Type.String({ description: "Function/method name to find callees of" }),
			mode: Type.Optional(
				Type.String({
					description: "Extraction mode: 'fast' (regex, default) or 'precise' (tree-sitter)",
					default: "fast",
				})
			),
			project: Type.Optional(
				Type.String({ description: "Project name within workspace" })
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			const args = ["trace", "callees", params.symbol, "--toon", "-m", params.mode ?? "fast"];
			args.push(...wsFlags(params.project));

			const output = run(args, ctx.cwd, 60_000);
			return { content: [{ type: "text", text: collapseOutput(output) }] };
		},
	});

	// ── grepai_trace_graph ─────────────────────────────────────────────────
	pi.registerTool({
		name: "grepai_trace_graph",
		label: "GrepAI Trace Graph",
		description:
			"Build a call graph (callers + callees) around a symbol. " +
			"Shows the full dependency neighborhood.",
		parameters: Type.Object({
			symbol: Type.String({ description: "Function/method name to build graph around" }),
			depth: Type.Optional(
				Type.Number({ description: "Max traversal depth (default: 2)", default: 2 })
			),
			mode: Type.Optional(
				Type.String({
					description: "Extraction mode: 'fast' (regex, default) or 'precise' (tree-sitter)",
					default: "fast",
				})
			),
			project: Type.Optional(
				Type.String({ description: "Project name within workspace" })
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			const args = [
				"trace", "graph", params.symbol,
				"--toon",
				"-m", params.mode ?? "fast",
				"-d", String(params.depth ?? 2),
			];
			args.push(...wsFlags(params.project));

			const output = run(args, ctx.cwd, 60_000);
			return { content: [{ type: "text", text: collapseOutput(output) }] };
		},
	});

	// ── grepai_index_status ────────────────────────────────────────────────
	pi.registerTool({
		name: "grepai_index_status",
		label: "GrepAI Index Status",
		description:
			"Show grepai index status — files indexed, chunks, provider info. " +
			(workspace ? `Can also show workspace "${workspace}" status.` : ""),
		parameters: Type.Object({
			workspace_status: Type.Optional(
				Type.Boolean({
					description: "Show workspace status instead of local index (default: false)",
					default: false,
				})
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			let output: string;
			if (params.workspace_status && workspace) {
				output = run(["workspace", "status", workspace], ctx.cwd);
			} else {
				output = run(["status", "--no-ui"], ctx.cwd);
			}
			return { content: [{ type: "text", text: collapseOutput(output) }] };
		},
	});

	// ── System prompt injection ────────────────────────────────────────────
	const mode = workspace ? `workspace "${workspace}"` : "local index";
	pi.on("before_agent_start", async (event, _ctx) => {
		const section =
			`\n\n## GrepAI — Semantic Code Search\n\n` +
			`grepai is available (${mode}). Use \`grepai_search\` as the PRIMARY search method ` +
			`for finding code by meaning. Use \`grepai_trace_callers\`/\`grepai_trace_callees\` ` +
			`before modifying functions to understand impact.\n` +
			(workspace
				? (defaultProject
					? `\nDefault workspace project: \`${defaultProject}\` (override with tool \`project\` parameter).\n`
					: `\nWorkspace projects can be filtered with the \`project\` parameter (e.g. "pl", "platforma").\n`)
				: "");
		return { systemPrompt: event.systemPrompt + section };
	});
}
