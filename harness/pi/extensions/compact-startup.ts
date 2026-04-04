/**
 * Compact Startup Extension
 *
 * Shows loaded resources as a chat message.
 * Collapsed by default — Ctrl+O (expandTools) to expand/collapse.
 *
 * Requires `quietStartup: true` in settings.json.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type Component, Container, Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

interface Item {
	name: string;
	desc: string;
}

interface Section {
	label: string;
	items: Item[];
}

interface StartupDetails {
	sections: Section[];
}

// Pad a string (which may contain ANSI codes) to a visible width
function padToWidth(s: string, w: number): string {
	const vis = visibleWidth(s);
	return vis < w ? s + " ".repeat(w - vis) : s;
}

export default function (pi: ExtensionAPI) {
	// ── renderer ─────────────────────────────────────────────────────────────
	pi.registerMessageRenderer("startup-resources", (message, options, theme) => {
		const { sections } = message.details as StartupDetails;
		const text = (s: string) => theme.fg("text", s);
		const dim = (s: string) => theme.fg("dim", s);

		if (!options.expanded) {
			// Collapsed — one stat per section, all on one line
			const parts = sections.map((s) => `${text(s.label)} ${dim(String(s.items.length))}`);
			const line = parts.join(dim("  ╱  ")) + "   " + dim("ctrl+o to expand");
			return new Text(" " + line, 0, 0);
		}

		// Expanded — aligned two-column table, one block per section
		const container = new Container();

		const tableComponent: Component = {
			render(width: number): string[] {
				const lines: string[] = [""];

				for (const sec of sections) {
					// Section header: label right-aligned count
					const labelStr = text(sec.label);
					const countStr = dim(String(sec.items.length));
					const gap = width - visibleWidth(labelStr) - visibleWidth(countStr) - 3;
					lines.push(
						truncateToWidth(
							` ${labelStr}${" ".repeat(Math.max(1, gap))}${countStr}`,
							width,
						),
					);
					lines.push(dim(" " + "─".repeat(Math.max(0, width - 2))));

					// Compute name column width (max name + gap)
					const maxName = Math.max(0, ...sec.items.map((i) => i.name.length));
					const nameCol = Math.min(maxName, Math.floor(width * 0.35));
					const descCol = width - nameCol - 5; // 1 indent + 1 gap + 2 pad

					for (const item of sec.items) {
						const truncName = item.name.length > nameCol
							? item.name.slice(0, nameCol - 1) + "…"
							: item.name;
						const styledName = padToWidth(text(truncName), nameCol);

						let styledDesc = "";
						if (item.desc && descCol > 4) {
							const d = item.desc.length > descCol
								? item.desc.slice(0, descCol - 1) + "…"
								: item.desc;
							styledDesc = dim(d);
						}

						lines.push(truncateToWidth(` ${styledName}  ${styledDesc}`, width));
					}

					lines.push("");
				}

				return lines;
			},
			invalidate() {},
		};

		container.addChild(tableComponent);
		return container;
	});

	// ── session_start ─────────────────────────────────────────────────────────
	pi.on("session_start", (_event, ctx) => {
		const alreadyPresent = ctx.sessionManager
			.getEntries()
			.some((e) => e.type === "custom_message" && (e as any).customType === "startup-resources");
		if (alreadyPresent) return;

		const commands = pi.getCommands();
		const skills = commands.filter((c) => c.source === "skill");
		const prompts = commands.filter((c) => c.source === "prompt");
		const extensions = commands.filter((c) => c.source === "extension");
		const tools = pi.getAllTools();

		const sections: Section[] = [];

		if (skills.length > 0) {
			sections.push({
				label: "Skills",
				items: skills.map((s) => ({ name: s.name, desc: s.description ?? "" })),
			});
		}
		if (prompts.length > 0) {
			sections.push({
				label: "Prompts",
				items: prompts.map((p) => ({ name: `/${p.name}`, desc: p.description ?? "" })),
			});
		}
		if (extensions.length > 0) {
			sections.push({
				label: "Extensions",
				items: extensions.map((e) => ({ name: `/${e.name}`, desc: e.description ?? "" })),
			});
		}
		if (tools.length > 0) {
			sections.push({
				label: "Tools",
				items: tools.map((t) => ({
					name: t.name,
					desc: t.description?.split("\n")[0] ?? "",
				})),
			});
		}

		if (sections.length === 0) return;

		pi.sendMessage({
			customType: "startup-resources",
			content: "",
			display: true,
			details: { sections } satisfies StartupDetails,
		});
	});
}
