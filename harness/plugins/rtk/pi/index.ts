/**
 * RTK (Rust Token Killer) — token-optimized CLI proxy for pi.
 *
 * Overrides the bash tool to route supported commands through `rtk`,
 * saving 60-90% tokens on dev operations (git, ls, find, grep, etc.).
 *
 * Also registers `/rtk-gain` and `/rtk-discover` commands.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool } from "@mariozechner/pi-coding-agent";

// Commands that rtk can proxy (from `rtk --help`)
const RTK_COMMANDS = new Set([
	"ls",
	"tree",
	"read",
	"git",
	"gh",
	"aws",
	"psql",
	"pnpm",
	"find",
	"diff",
	"docker",
	"kubectl",
	"grep",
	"wget",
	"wc",
	"vitest",
	"prisma",
	"tsc",
	"next",
	"lint",
	"prettier",
	"format",
	"playwright",
]);

/** Extract the first command token from a (possibly multiline) bash string. */
function firstCommand(command: string): string | undefined {
	// Skip env vars, leading whitespace, semicolons
	const trimmed = command.trimStart();
	// Handle pipes, &&, || — we only care about the very first token
	const match = trimmed.match(/^(?:sudo\s+)?(\S+)/);
	return match?.[1];
}

function shouldProxy(command: string): boolean {
	const cmd = firstCommand(command);
	return cmd !== undefined && RTK_COMMANDS.has(cmd);
}

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const rtkBash = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => ({
			command: `rtk ${command}`,
			cwd,
			env,
		}),
	});

	const plainBash = createBashTool(cwd);

	pi.registerTool({
		...plainBash,
		execute: async (id, params, signal, onUpdate, ctx) => {
			if (!shouldProxy(params.command)) {
				return plainBash.execute(id, params, signal, onUpdate);
			}

			const result = await rtkBash.execute(id, params, signal, onUpdate);

			// If rtk returned non-zero exit code, fallback to original command
			const details = result.details as Record<string, any> | undefined;
			if (details?.exitCode !== 0) {
				return plainBash.execute(id, params, signal, onUpdate);
			}

			return result;
		},
	});

	pi.registerCommand("rtk-gain", {
		description: "Show RTK token savings analytics",
		handler: async (_args, ctx) => {
			const result = await pi.exec("rtk", ["gain"], { timeout: 5000 });
			ctx.ui.notify(result.stdout || result.stderr || "No data", "info");
		},
	});

	pi.registerCommand("rtk-discover", {
		description: "Analyze history for missed RTK optimization opportunities",
		handler: async (_args, ctx) => {
			const result = await pi.exec("rtk", ["discover"], { timeout: 10000 });
			ctx.ui.notify(result.stdout || result.stderr || "No data", "info");
		},
	});
}
