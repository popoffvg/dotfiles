/**
 * Proposal text format — serialize, parse, validate.
 *
 * The proposal is a human-editable text file shown to the user (like git
 * interactive-rebase) before commits are executed.
 *
 * Format:
 *
 *   # smart-commit proposal
 *   # ... instructions ...
 *
 *   repo: /abs/path/to/repo
 *   branch: feat/my-branch
 *
 *   commit: feat: add health check endpoint
 *   # Rationale: isolated feature with tests
 *   hunk: h1   # server.go @@ -120,6 +120,25 @@ (+19/-0)
 *   hunk: h3   # health.go (new file, +85 lines)
 *
 *   commit: fix: nil pointer in graceful shutdown
 *   hunk: h2   # server.go @@ -45,8 +45,10 @@ (+2/-0)
 *
 * Rules (enforced by parseProposal):
 *   - Every hunk must appear in exactly one commit.
 *   - Hunk IDs must come from the provided repoContexts.
 *   - Each commit must have ≥1 hunk and a non-empty message.
 *   - Each repo must have ≥1 commit and a branch.
 */

import type { Hunk } from "./diff.ts";

// ── Public types ─────────────────────────────────────────────────────────────

export interface CommitPlan {
	message: string;
	rationale?: string;
	hunkIds: string[];
}

export interface RepoPlan {
	repo: string;
	branch: string;
	commits: CommitPlan[];
}

export interface RepoContext {
	repo: string;
	branch: string;
	hunks: Hunk[];
}

export type ParseResult = { ok: true; repos: RepoPlan[] } | { ok: false; errors: string[] };

// ── Formatting ────────────────────────────────────────────────────────────────

const HEADER = `\
# smart-commit proposal
# ─────────────────────────────────────────────────────────────────────
# HOW TO EDIT:
#   • Change commit messages freely  (lines starting with "commit:")
#   • Move "hunk:" lines between commits to reassign them
#   • To merge commits: move all hunk: lines, then delete the empty commit
#   • Do NOT edit hunk IDs (h1, h2 …)  — only move hunk: lines
#   • Lines starting with # are comments and are ignored
#   • Save empty / comments-only file to abort
# ─────────────────────────────────────────────────────────────────────
`;

function hunkDescription(h: Hunk): string {
	if (h.isNewFile) return `(new file, +${h.addedLines} lines)`;
	if (h.isDeletedFile) return `(deleted, -${h.removedLines} lines)`;
	return `${h.header} (+${h.addedLines}/-${h.removedLines})`;
}

/**
 * Format a proposal from LLM-supplied plans into human-editable text.
 * repoContexts is used to look up hunk descriptions.
 */
export function formatProposal(repoContexts: RepoContext[], plans: RepoPlan[]): string {
	const hunkInfo = new Map<string, Hunk>();
	for (const ctx of repoContexts) {
		for (const h of ctx.hunks) hunkInfo.set(h.id, h);
	}

	const blocks = plans.map((plan) => {
		const lines: string[] = [`repo: ${plan.repo}`, `branch: ${plan.branch}`, ""];

		for (const commit of plan.commits) {
			lines.push(`commit: ${commit.message}`);
			if (commit.rationale) lines.push(`# Rationale: ${commit.rationale}`);
			for (const id of commit.hunkIds) {
				const h = hunkInfo.get(id);
				const desc = h ? `${h.file} ${hunkDescription(h)}` : id;
				lines.push(`hunk: ${id}   # ${desc}`);
			}
			lines.push("");
		}

		return lines.join("\n");
	});

	return HEADER + "\n" + blocks.join("\n");
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parse and validate an edited proposal text.
 *
 * Returns ok:true with the parsed RepoPlan[] on success, or ok:false with a
 * list of human-readable error messages on failure.
 */
export function parseProposal(text: string, repoContexts: RepoContext[]): ParseResult {
	// Index valid repos and hunk IDs.
	const validRepos = new Set(repoContexts.map((r) => r.repo));
	/** hunkId → owning repo path */
	const hunkOwner = new Map<string, string>();
	for (const ctx of repoContexts) {
		for (const h of ctx.hunks) hunkOwner.set(h.id, ctx.repo);
	}

	const errors: string[] = [];
	const repos: RepoPlan[] = [];

	let currentRepo: RepoPlan | null = null;
	let currentCommit: CommitPlan | null = null;

	const rawLines = text.split("\n");

	// Strip inline comment from a line (everything after first unquoted #).
	function stripComment(s: string): string {
		const idx = s.indexOf("#");
		return idx >= 0 ? s.slice(0, idx) : s;
	}

	function finalizeCommit() {
		if (currentCommit && currentRepo) {
			currentRepo.commits.push(currentCommit);
			currentCommit = null;
		}
	}
	function finalizeRepo() {
		finalizeCommit();
		if (currentRepo) {
			repos.push(currentRepo);
			currentRepo = null;
		}
	}

	for (let i = 0; i < rawLines.length; i++) {
		const lineNum = i + 1;
		const raw = rawLines[i];
		const line = raw.trimEnd();

		// Skip comment lines and blank lines.
		if (line.trimStart().startsWith("#") || line.trim() === "") continue;

		if (line.startsWith("repo: ")) {
			finalizeRepo();
			const repoPath = line.slice("repo: ".length).trim();
			if (!validRepos.has(repoPath)) errors.push(`Line ${lineNum}: unknown repo "${repoPath}"`);
			currentRepo = { repo: repoPath, branch: "", commits: [] };
		} else if (line.startsWith("branch: ")) {
			if (!currentRepo) {
				errors.push(`Line ${lineNum}: "branch:" before any "repo:"`);
			} else {
				currentRepo.branch = line.slice("branch: ".length).trim();
			}
		} else if (line.startsWith("commit:")) {
			if (!currentRepo) {
				errors.push(`Line ${lineNum}: "commit:" before any "repo:"`);
				continue;
			}
			finalizeCommit();
			const message = line.slice("commit:".length).trim();
			if (!message) errors.push(`Line ${lineNum}: commit message is empty`);
			currentCommit = { message, hunkIds: [] };
		} else if (line.startsWith("hunk: ")) {
			if (!currentCommit) {
				errors.push(`Line ${lineNum}: "hunk:" before any "commit:"`);
				continue;
			}
			const hunkId = stripComment(line.slice("hunk: ".length)).trim();
			if (!hunkId) {
				errors.push(`Line ${lineNum}: empty hunk ID`);
				continue;
			}
			if (!hunkOwner.has(hunkId)) {
				errors.push(`Line ${lineNum}: unknown hunk ID "${hunkId}"`);
			}
			currentCommit.hunkIds.push(hunkId);
		} else {
			errors.push(`Line ${lineNum}: unexpected line: "${line}"`);
		}
	}

	finalizeRepo();

	// Check for empty proposal.
	if (repos.length === 0 && errors.length === 0) {
		return { ok: false, errors: ["Proposal is empty — interpreted as abort"] };
	}

	// Cross-commit validations.
	const assigned = new Map<string, string>(); // hunkId → "repo:commitMsg"
	for (const repo of repos) {
		if (!repo.branch) errors.push(`Repo "${repo.repo}": missing branch line`);
		if (repo.commits.length === 0) errors.push(`Repo "${repo.repo}": no commits defined`);

		for (const commit of repo.commits) {
			if (commit.hunkIds.length === 0) {
				errors.push(`Commit "${commit.message}" has no hunks — move hunks into it or delete it`);
			}
			for (const id of commit.hunkIds) {
				const prev = assigned.get(id);
				if (prev) {
					errors.push(`Hunk "${id}" is assigned to multiple commits ("${prev}" and "${commit.message}")`);
				} else {
					assigned.set(id, commit.message);
				}
				// Verify hunk belongs to this repo.
				const owner = hunkOwner.get(id);
				if (owner && owner !== repo.repo) {
					errors.push(`Hunk "${id}" belongs to repo "${owner}", not "${repo.repo}"`);
				}
			}
		}
	}

	// Every hunk must be assigned.
	for (const [id, owner] of hunkOwner) {
		if (!assigned.has(id)) {
			errors.push(`Hunk "${id}" (in ${owner}) is not assigned to any commit`);
		}
	}

	if (errors.length > 0) return { ok: false, errors };
	return { ok: true, repos };
}
