import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import { open, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
	createBashToolDefinition,
	getShellConfig,
	type BashOperations,
	type ExtensionAPI,
	type ExtensionUIContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";

/**
 * While pi waits on a shell command, the footer status line shows the alias
 * the agent invented for that call, and how long it has been running.
 * `!` commands also run as `background` tasks.
 */

const TASK_ID = /^\d{8}-\d{6}-[a-z0-9]+$/;
const POLL_MS = 80;
const STATUS_KEY = "shell";
const WIDGET_KEY = "shell-dashboard";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MAX_ROWS = 3;

interface WaitSlot {
	toolCallId: string;
}

interface StatusFile {
	exitCode: number;
	signaled?: boolean;
}

interface ShellJob {
	id: string;
	command: string;
	alias?: string;
	startedAt: number;
	taskId?: string;
	tail: string;
}

const slotStore = new AsyncLocalStorage<WaitSlot>();
const jobs = new Map<string, ShellJob>();

let ui: ExtensionUIContext | undefined;
let dash: ShellDashboard | undefined;
let dashTimer: ReturnType<typeof setInterval> | undefined;
let bangSeq = 0;
let refreshDashboard = () => {};

function userCacheDir(): string {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches");
	if (process.platform === "win32") {
		return process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
	}
	return process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
}

function tasksRoot(): string {
	return process.env.BG_HOME ?? path.join(userCacheDir(), "bg", "tasks");
}

let bgBin: string | undefined;

function resolveBgBin(): string {
	if (bgBin) return bgBin;
	const fromEnv = process.env.BG_BIN?.trim();
	bgBin = fromEnv || "background";
	return bgBin;
}

function commandText(value: unknown): string {
	if (typeof value !== "string") return "";
	const line = value.replace(/\s+/g, " ").trim();
	return line;
}

function inventedAlias(command: string, args?: Record<string, unknown>): string | undefined {
	const fromArgs = commandText(args?.alias) || commandText(args?.description);
	if (fromArgs && fromArgs !== commandText(args?.command)) return fromArgs;
	const first = command.split(/\r?\n/, 1)[0]?.trim() ?? "";
	const match = /^#alias:\s*(.+)$/.exec(first);
	const alias = match?.[1]?.trim();
	return alias || undefined;
}

function jobLabel(job: ShellJob): string {
	return job.alias || "shell";
}

function rememberJob(id: string, patch: Partial<ShellJob>): void {
	const prev = jobs.get(id);
	const command = commandText(patch.command) || prev?.command || "";
	const alias = commandText(patch.alias) || inventedAlias(command) || prev?.alias;
	jobs.set(id, {
		id,
		command,
		alias,
		startedAt: patch.startedAt ?? prev?.startedAt ?? Date.now(),
		taskId: patch.taskId ?? prev?.taskId,
		tail: patch.tail ?? prev?.tail ?? "",
	});
	refreshDashboard();
}

function forgetJob(id: string): void {
	if (!jobs.delete(id)) return;
	refreshDashboard();
}

function forgetCursorJob(command: string): void {
	const key = `cursor:${command}`;
	if (jobs.delete(key)) refreshDashboard();
	if (jobs.delete("cursor-shell")) refreshDashboard();
}

function noteShellFromText(text: string): void {
	const match = /Cursor shell:\s*([^\n]+)/.exec(text);
	const command = commandText(match?.[1]);
	if (!command || jobs.get("cursor-shell")?.command === command) return;
	rememberJob("cursor-shell", { command, alias: inventedAlias(command), tail: "waiting for result" });
}

function lastOutputLine(prev: string, chunk: string): string {
	const combined = `${prev}\n${chunk}`.replace(/\u001b\[[0-9;]*m/g, "");
	const lines = combined.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	return (lines.at(-1) ?? prev).slice(-180);
}

function ageLabel(startedAt: number): string {
	const seconds = Math.max(0, Date.now() - startedAt) / 1000;
	if (seconds < 10) return `${seconds.toFixed(1)}s`;
	if (seconds < 60) return `${Math.floor(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	const rest = Math.floor(seconds % 60);
	return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function statusText(): string | undefined {
	const list = [...jobs.values()];
	const job = list[0];
	if (!job) return undefined;
	const extra = list.length > 1 ? ` +${list.length - 1}` : "";
	const id = job.taskId ? ` ${job.taskId}` : "";
	const label = truncateToWidth(jobLabel(job), 42, "…");
	return `waiting ${label}${id} ${ageLabel(job.startedAt)}${extra}`;
}

function publishStatus(): void {
	const text = statusText();
	ui?.setStatus(STATUS_KEY, text);
	ui?.setWorkingMessage(text ? `waiting for result · ${text.slice("waiting ".length)}` : undefined);
}

class ShellDashboard implements Component {
	private frame = 0;

	constructor(
		private tui: TUI,
		private theme: Theme,
		private readJobs: () => ShellJob[],
	) {}

	tick(): void {
		this.frame = (this.frame + 1) % SPINNER.length;
		this.tui.requestRender();
	}

	request(): void {
		this.tui.requestRender();
	}

	invalidate(): void {}

	dispose(): void {}

	render(width: number): string[] {
		const jobsNow = this.readJobs();
		const inner = Math.max(0, width - 2);
		const waiting = jobsNow.length > 1 ? `waiting · ${jobsNow.length}` : "waiting";
		const shown = jobsNow.slice(0, MAX_ROWS);
		const hidden = jobsNow.length - shown.length;
		const hasTask = jobsNow.some((job) => job.taskId);
		const foot = hidden > 0 ? `+${hidden} more` : hasTask ? "open bg to watch" : "pi is waiting for the result";
		const spin = SPINNER[this.frame] ?? "⠋";
		return [
			this.rule("╭", "shell", waiting, "╮", inner),
			...shown.flatMap((job) => this.jobLines(job, inner, spin)),
			this.rule("╰", foot, "", "╯", inner),
		];
	}

	private rule(left: string, title: string, right: string, end: string, inner: number): string {
		return this.theme.bg("toolPendingBg", this.theme.fg("accent", boxEdge(left, title, right, end, inner)));
	}

	private jobLines(job: ShellJob, inner: number, spin: string): string[] {
		const theme = this.theme;
		const elapsed = ` ${ageLabel(job.startedAt)} `;
		const task = job.taskId ? ` · ${job.taskId}` : "";
		const mark = ` ${spin} `;
		const markW = visibleWidth(mark);
		const elapsedW = visibleWidth(elapsed);
		const taskW = visibleWidth(task);
		const room = Math.max(4, inner - markW - elapsedW - taskW);
		const label = truncateToWidth(jobLabel(job), room, "…");
		const gap = inner - markW - visibleWidth(label) - taskW - elapsedW;
		const head =
			theme.fg("warning", mark) +
			theme.bold(theme.fg("text", label)) +
			theme.fg("accent", task) +
			" ".repeat(Math.max(0, gap)) +
			theme.fg("muted", elapsed);
		const detail = truncateToWidth(job.tail || "waiting for result", Math.max(4, inner - 4), "…");
		const body = theme.fg("muted", `    ${detail}`) + " ".repeat(Math.max(0, inner - 4 - visibleWidth(detail)));
		return [this.band(head, inner), this.band(body, inner)];
	}

	private band(innerColored: string, inner: number): string {
		const gap = inner - visibleWidth(innerColored);
		const line = gap > 0 ? innerColored + " ".repeat(gap) : truncateToWidth(innerColored, inner, "");
		return this.theme.bg("toolPendingBg", this.theme.fg("accent", "│") + line + this.theme.fg("accent", "│"));
	}
}

function boxEdge(left: string, title: string, right: string, end: string, inner: number): string {
	let label = ` ${title} `;
	let trail = right ? ` ${right} ` : "";
	if (label.length + trail.length > inner) {
		const keepTrail = Math.min(trail.length, 18);
		label = label.slice(0, Math.max(0, inner - keepTrail));
		trail = trail.slice(0, Math.max(0, inner - label.length));
	}
	const dashes = "─".repeat(Math.max(0, inner - visibleWidth(label) - visibleWidth(trail)));
	const line = `${left}${label}${dashes}${trail}${end}`;
	const width = inner + visibleWidth(left) + visibleWidth(end);
	const got = visibleWidth(line);
	if (got < width) return line + "─".repeat(width - got);
	if (got > width) return truncateToWidth(line, width, "");
	return line;
}

function spawnCollected(
	bin: string,
	args: string[],
	cwd: string,
	env?: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stdout, stderr }));
	});
}

function parseTaskId(stdout: string): string {
	const line = stdout
		.split("\n")
		.map((item) => item.trim())
		.filter((item) => TASK_ID.test(item))
		.at(-1);
	if (!line) throw new Error(`background did not print a task id:\n${stdout}`);
	return line;
}

async function readNew(logPath: string, offset: number, onData: (data: Buffer) => void): Promise<number> {
	let handle;
	try {
		handle = await open(logPath, "r");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return offset;
		throw err;
	}
	try {
		const stat = await handle.stat();
		if (stat.size <= offset) return offset;
		const buf = Buffer.alloc(stat.size - offset);
		await handle.read(buf, 0, buf.length, offset);
		onData(buf);
		return stat.size;
	} finally {
		await handle.close();
	}
}

function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "EPERM";
	}
}

async function readMeta(metaPath: string): Promise<{ pid?: number; alias?: string }> {
	try {
		const raw = await readFile(metaPath, "utf8");
		const meta = JSON.parse(raw) as { pid?: number; alias?: string };
		return {
			pid: typeof meta.pid === "number" && meta.pid > 0 ? meta.pid : undefined,
			alias: commandText(meta.alias) || undefined,
		};
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
		if (err instanceof SyntaxError) return {};
		throw err;
	}
}

async function readStatus(statusPath: string): Promise<StatusFile | undefined> {
	try {
		const raw = await readFile(statusPath, "utf8");
		return JSON.parse(raw) as StatusFile;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		if (err instanceof SyntaxError) return undefined;
		throw err;
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("aborted"));
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new Error("aborted"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

async function stopTask(bin: string, id: string): Promise<void> {
	await new Promise<void>((resolve) => {
		const child = spawn(bin, ["kill", id], { stdio: "ignore" });
		child.on("error", () => resolve());
		child.on("close", () => resolve());
	});
}

function createBgOperations(): BashOperations {
	return {
		exec: async (command, cwd, { onData, signal, timeout, env }) => {
			const slot = slotStore.getStore();
			const jobId = slot?.toolCallId ?? `bang-${++bangSeq}`;
			const owned = !slot;
			rememberJob(jobId, { command, alias: inventedAlias(command) });
			const bin = resolveBgBin();
			let taskId: string | undefined;
			try {
				const shell = getShellConfig();
				if (shell.commandTransport === "stdin") {
					throw new Error("background shell wrapper does not support stdin command transport");
				}
				let launched;
				try {
					launched = await spawnCollected(bin, ["--", shell.shell, ...shell.args, command], cwd, env);
				} catch (err) {
					if ((err as NodeJS.ErrnoException).code === "ENOENT") {
						throw new Error("background is not on PATH. Install github.com/popoffvg/background as `background` (the `bg` alias).");
					}
					throw err;
				}
				if (launched.code !== 0) {
					throw new Error(launched.stderr.trim() || `background exited ${launched.code}`);
				}
				taskId = parseTaskId(launched.stdout);
				rememberJob(jobId, { taskId });

				const dir = path.join(tasksRoot(), taskId);
				const logPath = path.join(dir, "out.log");
				const statusPath = path.join(dir, "status.json");
				const metaPath = path.join(dir, "meta.json");
				const started = Date.now();
				let offset = 0;
				let deadSince: number | undefined;
				const timeoutMs = timeout !== undefined && timeout > 0 ? timeout * 1000 : undefined;

				while (true) {
					if (signal?.aborted) throw new Error("aborted");
					if (timeoutMs !== undefined && Date.now() - started > timeoutMs) {
						throw new Error(`timeout:${timeout}`);
					}
					offset = await readNew(logPath, offset, (buf) => {
						onData(buf);
						const current = jobs.get(jobId);
						rememberJob(jobId, { tail: lastOutputLine(current?.tail ?? "", buf.toString()) });
					});
					const status = await readStatus(statusPath);
					if (status) {
						await readNew(logPath, offset, onData);
						if (signal?.aborted) throw new Error("aborted");
						const exitCode = status.signaled && status.exitCode < 0 ? 143 : status.exitCode;
						return { exitCode };
					}
					const meta = await readMeta(metaPath);
					if (meta.alias) rememberJob(jobId, { alias: meta.alias });
					if (meta.pid !== undefined && !pidAlive(meta.pid)) {
						deadSince ??= Date.now();
						if (Date.now() - deadSince > 1500) {
							throw new Error(`background task ${taskId} ended without a status`);
						}
					} else {
						deadSince = undefined;
					}
					await sleep(POLL_MS, signal);
				}
			} catch (err) {
				if (taskId) await stopTask(bin, taskId);
				throw err;
			} finally {
				if (owned) forgetJob(jobId);
			}
		},
	};
}

function stopDashTimer(): void {
	if (!dashTimer) return;
	clearInterval(dashTimer);
	dashTimer = undefined;
}

function ensureDashTimer(): void {
	if (dashTimer) return;
	dashTimer = setInterval(() => {
		publishStatus();
		dash?.tick();
	}, 250);
	dashTimer.unref?.();
}

function partialText(result: unknown): string {
	if (!result || typeof result !== "object") return "";
	const content = (result as { content?: unknown }).content;
	if (!Array.isArray(content)) return "";
	return content
		.map((block) => (block && typeof block === "object" && "text" in block ? String((block as { text?: unknown }).text ?? "") : ""))
		.join("");
}

export default function (pi: ExtensionAPI) {
	const operations = createBgOperations();
	const definition = createBashToolDefinition(process.cwd(), { operations });
	const baseExecute = definition.execute.bind(definition);
	let bashViaBg = false;

	definition.execute = (toolCallId, params, signal, onUpdate, ctx) => {
		const slot: WaitSlot = { toolCallId };
		return slotStore.run(slot, () => baseExecute(toolCallId, params, signal, onUpdate, ctx));
	};

	const syncBashTool = (provider: string | undefined) => {
		if (provider === "cursor" || bashViaBg) return;
		pi.registerTool(definition);
		bashViaBg = true;
	};

	refreshDashboard = () => {
		if (!ui) return;
		publishStatus();
		if (jobs.size === 0) {
			stopDashTimer();
			if (!dash) return;
			dash = undefined;
			ui.setWidget(WIDGET_KEY, undefined);
			return;
		}
		ensureDashTimer();
		if (!dash) {
			ui.setWidget(WIDGET_KEY, (tui, theme) => {
				dash = new ShellDashboard(tui, theme, () => [...jobs.values()]);
				return dash;
			});
			return;
		}
		dash.invalidate();
		dash.request();
	};

	pi.on("before_agent_start", (event) => {
		const line =
			"On every shell call, invent a short alias and put it on the first line of the command as `#alias: the words`. The status line shows that alias, not the command.";
		const guidelines = event.systemPromptOptions.promptGuidelines;
		if (!guidelines.includes(line)) guidelines.push(line);
	});

	pi.on("session_start", (_event, ctx) => {
		ui = ctx.ui;
		jobs.clear();
		cursorBuf = "";
		stopDashTimer();
		dash = undefined;
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setWorkingMessage(undefined);
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		syncBashTool(ctx.model?.provider);
	});

	pi.on("model_select", (event) => {
		syncBashTool(event.model?.provider);
	});

	pi.on("tool_execution_start", (event) => {
		if (event.toolName !== "bash") return;
		const command = commandText(event.args?.command);
		const prior = jobs.get("cursor-shell") ?? (command ? jobs.get(`cursor:${command}`) : undefined);
		jobs.delete("cursor-shell");
		if (command) jobs.delete(`cursor:${command}`);
		rememberJob(event.toolCallId, {
			command,
			alias: inventedAlias(command, event.args),
			...(prior ? { startedAt: prior.startedAt, tail: prior.tail } : {}),
		});
	});

	pi.on("tool_execution_update", (event) => {
		if (event.toolName !== "bash" || !jobs.has(event.toolCallId)) return;
		const chunk = partialText(event.partialResult);
		if (!chunk) return;
		const current = jobs.get(event.toolCallId);
		rememberJob(event.toolCallId, { tail: lastOutputLine(current?.tail ?? "", chunk) });
	});

	pi.on("tool_execution_end", (event) => {
		if (event.toolName !== "bash") return;
		forgetJob(event.toolCallId);
		forgetJob("cursor-shell");
		const command = commandText(event.args?.command);
		if (command) forgetCursorJob(command);
	});

	pi.on("message_update", (event) => {
		const update = event.assistantMessageEvent;
		if (update.type === "thinking_delta" || update.type === "text_delta") {
			cursorBuf = `${cursorBuf}${update.delta}`.slice(-800);
		}
		noteShellFromText(cursorBuf);
		const message = event.message;
		if (message.role !== "assistant" || !Array.isArray(message.content)) return;
		for (const block of message.content) {
			if (!block || typeof block !== "object") continue;
			if (block.type === "thinking" && typeof block.thinking === "string") noteShellFromText(block.thinking);
			if (block.type === "text" && typeof block.text === "string") noteShellFromText(block.text);
			if (block.type === "toolCall" && block.name === "bash" && typeof block.id === "string") {
				const args = block.arguments;
				const command = commandText(args?.command);
				if (command) rememberJob(block.id, { command, alias: inventedAlias(command, args) });
			}
		}
	});

	pi.on("agent_end", () => {
		for (const id of [...jobs.keys()]) {
			if (id === "cursor-shell" || id.startsWith("cursor:")) forgetJob(id);
		}
	});

	pi.on("user_bash", () => ({ operations }));
}

let cursorBuf = "";
