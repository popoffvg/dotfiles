/**
 * Prompt Rewriter Extension
 *
 * Features:
 * - Ctrl+R (configurable): Rewrite prompt with approve/restore dialog
 * - Ctrl+Shift+I (configurable): Show hints for improving current prompt
 *
 * Flow:
 * 1. Press Ctrl+R → AI improves your prompt
 * 2. Dialog shows original vs improved versions
 * 3. Choose "Use Improved" or "Use Original"
 * 4. If original chosen, both versions saved to ~/.pi/agent/extensions/prompt-rewriter/rejected-improvements.jsonl for evaluation
 *
 * Config files (merged, project takes precedence):
 * - ~/.pi/agent/extensions/prompt-rewriter/config.json (global)
 * - .pi/extensions/prompt-rewriter/config.json (project-local)
 *
 * Example config.json:
 * ```json
 * {
 *   "provider": "anthropic",
 *   "model": "claude-sonnet-4-6",
 *   "rewriteShortcut": "ctrl+r",
 *   "hintsShortcut": "ctrl+shift+i"
 * }
 * ```
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { complete, getModel, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";

interface Config {
	/** LLM provider (default: "anthropic") */
	provider: string;
	/** Model ID (default: "claude-haiku-3-5-20241022") */
	model: string;
	/** Keyboard shortcut for rewrite (default: "ctrl+r") */
	rewriteShortcut: string;
	/** Keyboard shortcut for hints (default: "ctrl+shift+p") */
	hintsShortcut: string;
}

const DEFAULT_CONFIG: Config = {
	provider: "anthropic",
	model: "claude-haiku-4-5-20251001",
	rewriteShortcut: "ctrl+r",
	hintsShortcut: "ctrl+shift+i",
};

const REWRITE_SYSTEM_PROMPT = `Transform input to actionable instruction. No explanations, context, or choices.

Example:
Input: "TypeError: undefined"
Output: "fix the TypeError: undefined error"

Input: "help me"  
Output: "help with the current task"

Your input:`;

const HINTS_SYSTEM_PROMPT = `You are a prompt coaching assistant. You receive a user's draft prompt intended for a coding AI assistant.

Your job: Provide 2-5 short, actionable hints on how to improve this prompt. Focus on what's missing, vague, or could be more specific.

Output format — a numbered list, one hint per line:
1. <hint>
2. <hint>
...

Rules:
- Be concise. Each hint should be one sentence.
- Focus on actionable improvements: missing context, ambiguous scope, missing constraints, etc.
- If the prompt is already excellent, say "Prompt looks good! No improvements needed."
- Do NOT rewrite the prompt. Only give hints.`;

function loadConfig(cwd: string): Config {
	const globalPath = join(
		process.env.HOME || "~",
		".pi",
		"agent",
		"extensions",
		"prompt-rewriter",
		"config.json",
	);
	const projectPath = join(cwd, ".pi", "extensions", "prompt-rewriter", "config.json");

	let config = { ...DEFAULT_CONFIG };

	for (const path of [globalPath, projectPath]) {
		if (existsSync(path)) {
			try {
				const content = readFileSync(path, "utf-8");
				const parsed = JSON.parse(content);
				config = { ...config, ...parsed };
			} catch (err) {
				// Silently skip invalid config files - use defaults instead
				console.warn(`⚠️ Prompt Rewriter: Skipping invalid config at ${path}`);
			}
		}
	}

	// Hard guard: never bind rewrite to Tab or Ctrl+I (Ctrl+I sends Tab).
	const shortcut = (config.rewriteShortcut || "").trim().toLowerCase();
	if (shortcut === "tab" || shortcut === "ctrl+i") {
		console.warn("⚠️ Prompt Rewriter: tab/ctrl+i are disallowed; falling back to ctrl+r");
		config.rewriteShortcut = "ctrl+r";
	}

	return config;
}

async function callLLM(
	text: string,
	systemPrompt: string,
	config: Config,
	loaderMessage: string,
	ctx: ExtensionContext,
): Promise<string | null> {
	const model = getModel(config.provider, config.model);
	if (!model) {
		ctx.ui.notify(
			`🤖 Model Not Available\n\nThe model "${config.model}" from ${config.provider} isn't available.\n\n` +
			`💡 Try updating your config:\n` +
			`~/.pi/agent/extensions/prompt-rewriter/config.json\n\n` +
			`Suggested model: "claude-haiku-4-5-20251001"`,
			"error"
		);
		return null;
	}

	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		ctx.ui.notify(
			`🔑 Authentication Missing\n\n${auth.error}\n\n` +
			`💡 Set up your credentials:\n` +
			`• Run: pi auth ${config.provider}\n` +
			`• Or check your environment variables`,
			"error"
		);
		return null;
	}

	const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, loaderMessage);
		loader.onAbort = () => done(null);

		const doWork = async () => {
			const userMessage: UserMessage = {
				role: "user",
				content: [{ type: "text", text }],
				timestamp: Date.now(),
			};

			const response = await complete(
				model,
				{ systemPrompt, messages: [userMessage] },
				{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
			);

			if (response.stopReason === "aborted") {
				return null;
			}

			return response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n")
				.trim();
		};

		doWork()
			.then(done)
			.catch((err) => {
				console.error("Prompt rewriter LLM call failed:", err);
				
				// Determine user-friendly error message
				let userMessage = "🚫 AI Request Failed\n\n";
				if (err.message?.includes("rate limit") || err.message?.includes("429")) {
					userMessage += "Rate limit exceeded. Try again in a moment.";
				} else if (err.message?.includes("context_length") || err.message?.includes("token")) {
					userMessage += "Prompt too long. Try shortening your text.";
				} else if (err.message?.includes("network") || err.message?.includes("fetch")) {
					userMessage += "Connection error. Check your internet connection.";
				} else if (err.message?.includes("key") || err.message?.includes("auth")) {
					userMessage += "Authentication error. Check your API key.";
				} else {
					userMessage += "Something went wrong. Try again or check the console for details.";
				}
				
				// Show error after loader closes
				setTimeout(() => {
					ctx.ui.notify(userMessage, "error");
				}, 100);
				
				done(null);
			});

		return loader;
	});

	return result;
}

function saveRejectedImprovement(original: string, improved: string, cwd: string) {
	const logDir = join(process.env.HOME || "~", ".pi", "agent", "extensions", "prompt-rewriter");
	const logFile = join(logDir, "rejected-improvements.jsonl");
	
	try {
		// Ensure directory exists
		mkdirSync(logDir, { recursive: true });
		
		const entry = {
			timestamp: new Date().toISOString(),
			original: original.trim(),
			improved: improved.trim(),
			project: cwd
		};
		
		appendFileSync(logFile, JSON.stringify(entry) + '\n');
		console.log(`Saved rejected improvement to ${logFile}`);
	} catch (err) {
		console.error("Failed to save rejected improvement:", err);
	}
}

export function register(pi: ExtensionAPI) {
	let config: Config = DEFAULT_CONFIG;
	let originalPrompt: string | null = null;

	// --- Rewrite handler ---
	async function handleRewrite(ctx: ExtensionContext) {
		const currentText = ctx.ui.getEditorText();
		if (!currentText?.trim()) {
			ctx.ui.notify("✍️ Write something first!\n\nType your prompt in the editor, then press Ctrl+R to improve it.", "warning");
			return;
		}

		const responseText = await callLLM(
			currentText,
			REWRITE_SYSTEM_PROMPT,
			config,
			`✨ Improving your prompt with ${config.model.split('-')[1]?.toUpperCase() || 'AI'}...`,
			ctx,
		);

		if (!responseText) {
			ctx.ui.notify("🚫 Rewrite cancelled", "info");
			return;
		}

		// Response is always a rewritten prompt
		
		// Save original before rewriting
		originalPrompt = currentText;

		// Show approve/restore dialog with both prompts
		const dialogMessage = `ORIGINAL:\n${originalPrompt}\n\n` +
			`IMPROVED:\n${responseText}\n\n` +
			`Choose which version to use:`;

		const choice = await ctx.ui.confirm(
			"Compare Prompts",
			dialogMessage,
			{
				confirmLabel: "Use Improved",
				cancelLabel: "Use Original"
			}
		);
		
		if (choice) {
			// User chose "Use Improved"
			ctx.ui.setEditorText(responseText);
			ctx.ui.notify("✅ Using improved prompt!", "success");
		} else {
			// User chose "Use Original" or pressed ESC - save for evaluation
			saveRejectedImprovement(originalPrompt, responseText, ctx.cwd);
			ctx.ui.setEditorText(originalPrompt);
			ctx.ui.notify("↩️ Using original prompt (improvement saved for evaluation)", "info");
		}
		
		originalPrompt = null; // Clear saved prompt
	}

	// --- Hints handler ---
	async function handleHints(ctx: ExtensionContext) {
		const currentText = ctx.ui.getEditorText();
		if (!currentText?.trim()) {
			ctx.ui.notify("💡 Need something to analyze!\n\nType your prompt in the editor, then press Ctrl+Shift+I for improvement hints.", "warning");
			return;
		}

		const responseText = await callLLM(
			currentText,
			HINTS_SYSTEM_PROMPT,
			config,
			`💡 Analyzing your prompt for improvement tips...`,
			ctx,
		);

		if (!responseText) {
			ctx.ui.notify("🚫 Hints cancelled", "info");
			return;
		}

		// Show hints as a widget above the editor
		const lines = responseText.split("\n").filter((l) => l.trim());
		ctx.ui.setWidget("prompt-hints", [
			"💡 Prompt hints:",
			...lines,
			"",
			"(dismiss: Ctrl+Shift+H on empty editor or type to edit)",
		]);
	}



	// Load config on session start
	pi.on("session_start", async (_event, ctx) => {
		config = loadConfig(ctx.cwd);
	});

	// Sync config load for shortcut registration (must happen at load time)
	const initConfig = loadConfig(process.cwd());
	config = initConfig;

	// Register rewrite shortcut
	pi.registerShortcut(initConfig.rewriteShortcut, {
		description: "Rewrite prompt with LLM",
		handler: async (ctx) => {
			await handleRewrite(ctx);
		},
	});

	// Register hints shortcut
	pi.registerShortcut(initConfig.hintsShortcut, {
		description: "Show hints for improving current prompt",
		handler: async (ctx) => {
			// If editor is empty, dismiss the widget
			const currentText = ctx.ui.getEditorText();
			if (!currentText?.trim()) {
				ctx.ui.setWidget("prompt-hints", undefined);
				return;
			}
			await handleHints(ctx);
		},
	});

	// Clear hints widget when user submits a prompt
	pi.on("input", async (event, ctx) => {
		ctx.ui.setWidget("prompt-hints", undefined);

		const submitted = (event.text || "").trim();
		if (submitted.startsWith("/improve")) {
			const rest = submitted.replace(/^\/improve\b\s*/, "").trim();
			if (rest) {
				ctx.ui.setEditorText(rest);
			}
			await handleRewrite(ctx);
		}

		return { action: "continue" as const };
	});

	// /rewrite command
	pi.registerCommand("rewrite", {
		description: "Rewrite the current editor prompt using a fast LLM",
		handler: async (_args, ctx) => {
			await handleRewrite(ctx);
		},
	});

	// /hints command
	pi.registerCommand("hints", {
		description: "Show hints for improving the current editor prompt",
		handler: async (_args, ctx) => {
			await handleHints(ctx);
		},
	});

	// /improve command (alias for /rewrite)
	pi.registerCommand("improve", {
		description: "Improve the current editor prompt (alias of /rewrite)",
		handler: async (_args, ctx) => {
			await handleRewrite(ctx);
		},
	});
}
