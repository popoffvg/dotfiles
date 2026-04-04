/**
 * Commit executor — worktree + patch + cherry-pick flow.
 *
 * For each repo in the approved plan:
 *   1. Save full diff and create an isolated git worktree.
 *   2. Build per-commit patches from selected hunks and apply them sequentially.
 *   3. Verify the final worktree state matches the original working tree.
 *   4. Cherry-pick all new commits back onto the original branch.
 *   5. Clean up the worktree.
 *
 * Designed for dependency injection: takes an ExecFn so it can be tested
 * without a real git installation.
 */

import type { FileDiff, Hunk } from "./diff.ts";
import type { RepoPlan } from "./proposal.ts";
import { buildPatch } from "./diff.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExecResult = { stdout: string; stderr: string; code: number };
export type ExecFn = (cmd: string, args: string[]) => Promise<ExecResult>;

export interface CommitResult {
	sha: string;
	message: string;
}

export interface RepoExecResult {
	repo: string;
	commits: CommitResult[];
	error?: string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function executeRepoPlan(
	plan: RepoPlan,
	fileDiffs: FileDiff[],
	hunkMap: Map<string, Hunk>,
	exec: ExecFn,
): Promise<RepoExecResult> {
	const repo = plan.repo;
	const tmpDir = os.tmpdir();
	const stamp = Date.now();
	const baseName = path.basename(repo);
	const wtDir = path.join(tmpDir, `smart-commit-wt-${baseName}-${stamp}`);
	const tempBranch = `_smart-commit-tmp-${stamp}`;

	try {
		// 1. Create worktree on a temp branch from HEAD.
		await mustExec(exec, "git", ["-C", repo, "worktree", "add", "-b", tempBranch, wtDir, "HEAD"]);

		// 2. Build and apply per-commit patches.
		const commitShas: string[] = [];

		for (let i = 0; i < plan.commits.length; i++) {
			const commit = plan.commits[i];
			const selected = new Set(commit.hunkIds);

			const patchText = buildPatch(fileDiffs, selected);
			if (!patchText.trim()) {
				throw new Error(`Commit "${commit.message}": patch is empty — no hunks selected`);
			}

			const patchPath = path.join(tmpDir, `sc-${baseName}-${stamp}-${i + 1}.patch`);
			fs.writeFileSync(patchPath, patchText, "utf8");

			// Try plain apply first, then progressively looser fallbacks.
			const applyOk = await tryApply(exec, wtDir, patchPath);
			if (!applyOk) {
				throw new Error(`git apply failed for commit "${commit.message}" — check for conflicts`);
			}

			// Stage only the files touched by this commit.
			const touchedFiles = [...new Set(commit.hunkIds.map((id) => hunkMap.get(id)!.file))];
			for (const file of touchedFiles) {
				const r = await exec("git", ["-C", wtDir, "add", "--", file]);
				if (r.code !== 0) throw new Error(`git add "${file}" failed: ${r.stderr}`);
			}

			const commitR = await exec("git", ["-C", wtDir, "commit", "-m", commit.message]);
			if (commitR.code !== 0) {
				throw new Error(`git commit failed for "${commit.message}": ${commitR.stderr}`);
			}

			const shaR = await exec("git", ["-C", wtDir, "rev-parse", "HEAD"]);
			if (shaR.code !== 0) throw new Error("git rev-parse HEAD failed");
			commitShas.push(shaR.stdout.trim());
		}

		// 3. Verify: worktree final state must match original working tree.
		//    Skip deleted files (they don't exist in the worktree after deletion commit).
		const allFiles = [
			...new Set(plan.commits.flatMap((c) => c.hunkIds.map((id) => hunkMap.get(id)!.file))),
		];
		for (const file of allFiles) {
			const hunk = [...hunkMap.values()].find((h) => h.file === file);
			if (hunk?.isDeletedFile) continue; // file was deleted — skip

			const wtFile = path.join(wtDir, file);
			const origFile = path.join(repo, file);

			if (!fs.existsSync(wtFile) && !fs.existsSync(origFile)) continue;

			const diffR = await exec("diff", [wtFile, origFile]);
			if (diffR.code !== 0) {
				throw new Error(
					`Verification failed: "${file}" differs between worktree and working tree.\n${diffR.stdout}`,
				);
			}
		}

		// 4. Discard working-tree changes and cherry-pick commits back.
		await mustExec(exec, "git", ["-C", repo, "checkout", "--", "."]);
		const cpR = await exec("git", ["-C", repo, "cherry-pick", ...commitShas]);
		if (cpR.code !== 0) {
			// Try to abort the cherry-pick so the repo stays clean.
			await exec("git", ["-C", repo, "cherry-pick", "--abort"]).catch(() => {});
			throw new Error(`cherry-pick failed: ${cpR.stderr}`);
		}

		// Collect commit info from the log.
		const logR = await exec("git", ["-C", repo, "log", "--oneline", `-${plan.commits.length}`]);
		const logLines = logR.stdout
			.trim()
			.split("\n")
			.reverse()
			.map((l) => l.split(" "));
		const commits: CommitResult[] = plan.commits.map((c, i) => ({
			sha: (logLines[i]?.[0] ?? commitShas[i]).slice(0, 8),
			message: c.message,
		}));

		return { repo, commits };
	} catch (err) {
		return { repo, commits: [], error: (err as Error).message };
	} finally {
		// 5. Always clean up temp worktree and branch.
		await exec("git", ["-C", repo, "worktree", "remove", wtDir, "--force"]).catch(() => {});
		await exec("git", ["-C", repo, "branch", "-D", tempBranch]).catch(() => {});
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tryApply(exec: ExecFn, wtDir: string, patchPath: string): Promise<boolean> {
	// Plain apply.
	const r1 = await exec("git", ["-C", wtDir, "apply", patchPath]);
	if (r1.code === 0) return true;

	// 3-way merge fallback.
	const r2 = await exec("git", ["-C", wtDir, "apply", "--3way", patchPath]);
	if (r2.code === 0) return true;

	// Zero-context fallback (last resort).
	const r3 = await exec("git", ["-C", wtDir, "apply", "-C0", patchPath]);
	return r3.code === 0;
}

async function mustExec(exec: ExecFn, cmd: string, args: string[]): Promise<ExecResult> {
	const r = await exec(cmd, args);
	if (r.code !== 0) throw new Error(`${cmd} ${args.join(" ")}: ${r.stderr || r.stdout}`);
	return r;
}
