/**
 * Smart Commit — pi extension.
 *
 * Registers:
 *   /smart-commit  command — discovers repos, collects diffs, pre-parses hunks,
 *                            then sends the LLM a compact hunk summary and asks
 *                            it to propose a logical grouping via smart_commit.
 *
 *   smart_commit   tool   — receives the LLM's proposed grouping, formats it as
 *                           an editable proposal file (interactive-rebase style),
 *                           opens it in the TUI editor, validates on save (loops
 *                           on errors), then executes commits in TypeScript.
 *
 * LLM tool calls per run: 1 (smart_commit).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { parseUnifiedDiff } from "./diff.ts";
import { formatProposal, parseProposal, type RepoContext, type RepoPlan } from "./proposal.ts";
import { executeRepoPlan } from "./executor.ts";
import type { FileDiff, Hunk } from "./diff.ts";

const MAX_DIFF_BYTES = 150_000;

// ── Per-invocation context (populated by /smart-commit, consumed by smart_commit) ──

interface InternalRepoContext extends RepoContext {
	fileDiffs: FileDiff[];
	status: string;
	log: string;
}

export function register(pi: ExtensionAPI) {
	let repoContexts: InternalRepoContext[] = [];

	// ── Tool: smart_commit ──────────────────────────────────────────────────
	pi.registerTool({
		name: "smart_commit",
		label: "Smart Commit",
		description:
			"Accept a proposed commit grouping, open an interactive editor for user review, " +
			"validate, then execute commits. Call this after analyzing the hunk summary " +
			"provided by the smart-commit command.",
		parameters: Type.Object({
			repos: Type.Array(
				Type.Object({
					repo: Type.String({ description: "Absolute repo path, exactly as provided in the hunk summary" }),
					branch: Type.String({ description: "Current branch name" }),
					commits: Type.Array(
						Type.Object({
							message: Type.String({ description: "Commit message, imperative mood, ≤72 chars" }),
							rationale: Type.Optional(Type.String({ description: "Why this is a separate commit" })),
							hunk_ids: Type.Array(Type.String(), {
								description: "Hunk IDs (e.g. h1, h2) — use IDs exactly as listed in the summary",
							}),
						}),
						{ description: "Commits in order for this repo" },
					),
				}),
				{ description: "One entry per repo with changes" },
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Error: interactive UI required for smart_commit" }],
					details: { ok: false, error: "no UI" },
				};
			}

			// Build RepoPlan[] from the LLM's parameters.
			const plans: RepoPlan[] = params.repos.map((r) => ({
				repo: r.repo,
				branch: r.branch,
				commits: r.commits.map((c) => ({
					message: c.message,
					rationale: c.rationale,
					hunkIds: c.hunk_ids,
				})),
			}));

			// Quick pre-validation: all hunk IDs must be known.
			const hunkMap = new Map<string, Hunk>(repoContexts.flatMap((rc) => rc.hunks.map((h) => [h.id, h])));
			const earlyErrors: string[] = [];
			for (const plan of plans) {
				const rc = repoContexts.find((r) => r.repo === plan.repo);
				if (!rc) {
					earlyErrors.push(`Unknown repo: ${plan.repo}`);
					continue;
				}
				const repoHunkIds = new Set(rc.hunks.map((h) => h.id));
				for (const c of plan.commits) {
					for (const id of c.hunkIds) {
						if (!repoHunkIds.has(id)) earlyErrors.push(`Unknown hunk ID "${id}" for ${plan.repo}`);
					}
				}
			}
			if (earlyErrors.length > 0) {
				return {
					content: [{ type: "text", text: `Invalid proposal:\n${earlyErrors.join("\n")}` }],
					details: { ok: false, errors: earlyErrors },
				};
			}

			// ── Editor loop (interactive-rebase style) ──────────────────────
			let proposalText = formatProposal(repoContexts, plans);

			while (true) {
				const edited = await ctx.ui.editor("smart-commit proposal — edit then save (Esc to abort)", proposalText);

				if (!edited || edited.replace(/#.*$/gm, "").trim() === "") {
					return {
						content: [{ type: "text", text: "Aborted." }],
						details: { ok: false, aborted: true },
					};
				}

				const parseResult = parseProposal(edited, repoContexts);

				if (!parseResult.ok) {
					// Prepend errors as comment lines; re-open so the user can fix them.
					const errorBlock = parseResult.errors.map((e) => `# ERROR: ${e}`).join("\n");
					proposalText = `${errorBlock}\n# Fix the errors above then save.\n\n${edited}`;
					ctx.ui.notify(`${parseResult.errors.length} error(s) in proposal — fix and re-save`, "warning");
					continue;
				}

				// ── Execute commits ─────────────────────────────────────────
				ctx.ui.setStatus("smart-commit", "Executing commits…");

				const execFn = (cmd: string, args: string[]) => pi.exec(cmd, args);

				const results = await Promise.all(
					parseResult.repos.map((repoPlan) => {
						const rc = repoContexts.find((r) => r.repo === repoPlan.repo)!;
						return executeRepoPlan(repoPlan, rc.fileDiffs, hunkMap, execFn);
					}),
				);

				ctx.ui.setStatus("smart-commit", undefined);

				const successes = results.filter((r) => !r.error);
				const failures = results.filter((r) => r.error);

				const lines: string[] = [];
				for (const r of successes) {
					lines.push(`✓ ${r.repo}`);
					for (const c of r.commits) lines.push(`  ${c.sha} ${c.message}`);
				}
				for (const r of failures) lines.push(`✗ ${r.repo}: ${r.error}`);

				const summary = lines.join("\n");

				// Report which repos were touched.
				const touchedRepos = successes.map((r) => r.repo);
				if (touchedRepos.length > 0) {
					ctx.ui.notify(`Touched repos:\n${touchedRepos.map((r) => `  ${r}`).join("\n")}`, "info");
				}

				if (failures.length > 0) {
					return {
						content: [{ type: "text", text: `Partial failure:\n${summary}` }],
						details: { ok: false, results, touchedRepos },
					};
				}
				return {
					content: [{ type: "text", text: `Done:\n${summary}` }],
					details: { ok: true, results, touchedRepos },
				};
			}
		},
	});

	// ── Command: /smart-commit ──────────────────────────────────────────────
	pi.registerCommand("smart-commit", {
		description: "Analyze diff, propose logical commit split, get approval, then commit",

		handler: async (_args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("Agent is busy — wait for it to finish first.", "warning");
				return;
			}

			ctx.ui.setStatus("smart-commit", "Discovering repos…");

			// Discover git repos with uncommitted changes.
			const discoverScript = `
			{
			  repo=$(git rev-parse --show-toplevel 2>/dev/null)
			  if [ -n "$repo" ] && [ -n "$(git -C "$repo" status --porcelain 2>/dev/null)" ]; then
			    echo "$repo"
			  fi
			  find . -maxdepth 2 -name .git 2>/dev/null | while read gitpath; do
			    repo=$(dirname "$gitpath")
			    if [ -n "$(git -C "$repo" status --porcelain 2>/dev/null)" ]; then
			      git -C "$repo" rev-parse --show-toplevel
			    fi
			  done
			} | sort -u
			`;

			const discoverR = await pi.exec("bash", ["-c", discoverScript], { cwd: ctx.cwd });
			const repos = discoverR.stdout.trim().split("\n").filter(Boolean);

			ctx.ui.setStatus("smart-commit", undefined);

			if (repos.length === 0) {
				ctx.ui.notify("No git changes detected in or near current directory.", "warning");
				return;
			}

			ctx.ui.setStatus("smart-commit", "Collecting diffs…");

			// Collect diff data in parallel.
			const rawData = await Promise.all(
				repos.map(async (repo) => {
					const [statusR, diffR, branchR, logR] = await Promise.all([
						pi.exec("git", ["-C", repo, "status", "--short"]),
						pi.exec("git", ["-C", repo, "diff", "HEAD"]),
						pi.exec("git", ["-C", repo, "branch", "--show-current"]),
						pi.exec("git", ["-C", repo, "log", "--oneline", "-5"]),
					]);
					return {
						repo,
						status: statusR.stdout,
						diff: diffR.stdout,
						branch: branchR.stdout.trim(),
						log: logR.stdout,
					};
				}),
			);

			const totalBytes = rawData.reduce((s, r) => s + r.diff.length, 0);
			if (totalBytes > MAX_DIFF_BYTES) {
				ctx.ui.notify(
					`Diff is large (${Math.round(totalBytes / 1024)} KB). Consider committing in smaller batches.`,
					"warning",
				);
			}

			// Parse diffs, assign globally unique hunk IDs across all repos.
			let hunkStartId = 1;
			repoContexts = rawData.map(({ repo, diff, branch, status, log }) => {
				const parsed = parseUnifiedDiff(diff, hunkStartId);
				hunkStartId += parsed.hunks.length;
				return { repo, branch, status, log, hunks: parsed.hunks, fileDiffs: parsed.files };
			});

			if (repoContexts.every((rc) => rc.hunks.length === 0)) {
				ctx.ui.notify("No diff hunks found (maybe only untracked files?).", "warning");
				return;
			}

			// Build a compact hunk summary for the LLM.
			// Includes IDs, file, location, change size, and a short snippet of changed lines.
			const hunkSummaries = repoContexts
				.map((rc) => {
					const hunkList = rc.hunks
						.map((h) => {
							const loc = h.isNewFile
								? `(new file, +${h.addedLines} lines)`
								: h.isDeletedFile
									? `(deleted, -${h.removedLines} lines)`
									: `${h.header} (+${h.addedLines}/-${h.removedLines})`;
							const snippet = h.snippet ? `\n    ${h.snippet.split("\n").join("\n    ")}` : "";
							return `  ${h.id.padEnd(4)} ${h.file} ${loc}${snippet}`;
						})
						.join("\n");

					return `## Repo: ${rc.repo}
Branch: ${rc.branch}
Status:
${rc.status.trim()}
Recent commits:
${rc.log.trim()}
Hunks (assign these IDs in smart_commit):
${hunkList}`;
				})
				.join("\n\n---\n\n");

			const prompt = `\
You are executing the smart-commit workflow.

${hunkSummaries}

---

Analyze the hunks above and group them into **logical commits** per repo:
- New features (together with their tests)
- Bug fixes (isolated from features)
- Refactors (no behaviour change)
- Config / dependency / chore changes
- Documentation

Rules:
- Every hunk ID must appear in **exactly one** commit.
- Use the hunk IDs exactly as shown (h1, h2, …).
- Commit messages: imperative mood, ≤72 chars.
- Conventional types: feat fix test doc refactor chore perf style

Call the **smart_commit** tool with your proposed grouping.`;

			pi.sendUserMessage(prompt);
		},
	});
}
