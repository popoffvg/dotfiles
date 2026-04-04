import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatProposal, parseProposal, type RepoContext, type RepoPlan } from "../proposal.ts";
import { parseUnifiedDiff } from "../diff.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DIFF_A = `\
diff --git a/server.go b/server.go
index abc..def 100644
--- a/server.go
+++ b/server.go
@@ -10,3 +10,5 @@ func Foo() {
 ctx
+added A
 ctx
@@ -40,3 +42,3 @@ func Bar() {
 ctx
-old
+new
 ctx
diff --git a/health.go b/health.go
new file mode 100644
index 0000000..aabbcc
--- /dev/null
+++ b/health.go
@@ -0,0 +1,3 @@
+package main
+func Health() {}
`;

const DIFF_B = `\
diff --git a/config.go b/config.go
index 111..222 100644
--- a/config.go
+++ b/config.go
@@ -5,3 +5,4 @@ var cfg Config
 // ctx
+newField string
 // ctx
`;

function makeContexts(): RepoContext[] {
	// Pass startId so hunk IDs are globally unique across repos.
	// DIFF_A produces 3 hunks → h1, h2, h3.
	// DIFF_B starts at h4 → h4.
	const parsedA = parseUnifiedDiff(DIFF_A, 1);
	const parsedB = parseUnifiedDiff(DIFF_B, parsedA.hunks.length + 1);
	return [
		{ repo: "/repo/alpha", branch: "feat/x", hunks: parsedA.hunks },
		{ repo: "/repo/beta", branch: "main", hunks: parsedB.hunks },
	];
}

function makePlans(ctxs: RepoContext[]): RepoPlan[] {
	// Assign alpha hunks: h1+h3 → commit 1, h2 → commit 2
	// Assign beta hunk: h4 → commit 1
	return [
		{
			repo: "/repo/alpha",
			branch: "feat/x",
			commits: [
				{ message: "feat: add health endpoint", rationale: "new feature", hunkIds: ["h1", "h3"] },
				{ message: "fix: replace old with new", hunkIds: ["h2"] },
			],
		},
		{
			repo: "/repo/beta",
			branch: "main",
			commits: [{ message: "chore: add config field", hunkIds: ["h4"] }],
		},
	];
}

// ── formatProposal ────────────────────────────────────────────────────────────

describe("formatProposal", () => {
	it("includes instruction header", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		assert.ok(text.includes("# smart-commit proposal"));
		assert.ok(text.includes("HOW TO EDIT"));
	});

	it("emits repo: and branch: lines", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		assert.ok(text.includes("repo: /repo/alpha"));
		assert.ok(text.includes("branch: feat/x"));
		assert.ok(text.includes("repo: /repo/beta"));
		assert.ok(text.includes("branch: main"));
	});

	it("emits commit: lines with the right messages", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		assert.ok(text.includes("commit: feat: add health endpoint"));
		assert.ok(text.includes("commit: fix: replace old with new"));
		assert.ok(text.includes("commit: chore: add config field"));
	});

	it("emits hunk: lines with IDs", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		assert.ok(text.includes("hunk: h1"));
		assert.ok(text.includes("hunk: h2"));
		assert.ok(text.includes("hunk: h3"));
		assert.ok(text.includes("hunk: h4"));
	});

	it("includes hunk descriptions as inline comments", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		// h3 is a new file (health.go)
		assert.ok(text.match(/hunk: h3.*new file/));
	});

	it("includes rationale as comment line", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		assert.ok(text.includes("# Rationale: new feature"));
	});
});

// ── parseProposal — valid inputs ──────────────────────────────────────────────

describe("parseProposal – valid", () => {
	it("round-trips a formatted proposal", () => {
		const ctxs = makeContexts();
		const text = formatProposal(ctxs, makePlans(ctxs));
		const result = parseProposal(text, ctxs);
		assert.ok(result.ok, `expected ok, got errors: ${!result.ok ? result.errors.join(", ") : ""}`);
		if (!result.ok) return;
		assert.equal(result.repos.length, 2);
		assert.equal(result.repos[0].commits.length, 2);
		assert.equal(result.repos[1].commits.length, 1);
	});

	it("parses correctly after user edits commit message", () => {
		const ctxs = makeContexts();
		let text = formatProposal(ctxs, makePlans(ctxs));
		text = text.replace("feat: add health endpoint", "feat: add /health check");
		const result = parseProposal(text, ctxs);
		assert.ok(result.ok);
		if (!result.ok) return;
		assert.equal(result.repos[0].commits[0].message, "feat: add /health check");
	});

	it("parses after user moves a hunk between commits", () => {
		const ctxs = makeContexts();
		// Build proposal where h1+h3 → commit1 and h2 → commit2, then move h3 to commit2
		let text = formatProposal(ctxs, makePlans(ctxs));
		// Remove hunk h3 from commit1 block and insert it before h2 in commit2 block
		text = text.replace(/^hunk: h3.*$/m, "");
		text = text.replace(/^(hunk: h2.*)$/m, "hunk: h3\n$1");
		const result = parseProposal(text, ctxs);
		assert.ok(result.ok, `errors: ${!result.ok ? result.errors.join(", ") : ""}`);
		if (!result.ok) return;
		const c2 = result.repos[0].commits[1];
		assert.ok(c2.hunkIds.includes("h3"));
		assert.ok(c2.hunkIds.includes("h2"));
	});

	it("ignores comment lines and blank lines", () => {
		const ctxs = makeContexts();
		const text = `
# this whole comment block is ignored

repo: /repo/alpha
branch: feat/x

# another comment
commit: feat: do stuff
hunk: h1   # inline comment — ignored
hunk: h2
hunk: h3

repo: /repo/beta
branch: main
commit: chore: update config
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(result.ok, `errors: ${!result.ok ? result.errors.join(", ") : ""}`);
		if (!result.ok) return;
		assert.equal(result.repos[0].commits[0].hunkIds.length, 3);
	});
});

// ── parseProposal — invalid inputs ───────────────────────────────────────────

describe("parseProposal – invalid", () => {
	it("returns abort for empty text", () => {
		const ctxs = makeContexts();
		const result = parseProposal("", ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => /empty|abort/i.test(e)));
	});

	it("returns abort for comments-only text", () => {
		const ctxs = makeContexts();
		const result = parseProposal("# just a comment\n# another\n", ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => /empty|abort/i.test(e)));
	});

	it("reports unknown repo path", () => {
		const ctxs = makeContexts();
		const text = `
repo: /repo/nonexistent
branch: main
commit: feat: stuff
hunk: h1
hunk: h2
hunk: h3
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => e.includes("nonexistent")));
	});

	it("reports unknown hunk ID", () => {
		const ctxs = makeContexts();
		// Valid proposal structure but uses h99 which doesn't exist
		const text = `
repo: /repo/alpha
branch: feat/x
commit: feat: foo
hunk: h1
hunk: h2
hunk: h99

repo: /repo/beta
branch: main
commit: chore: bar
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => e.includes("h99")));
	});

	it("reports duplicate hunk assignment", () => {
		const ctxs = makeContexts();
		const text = `
repo: /repo/alpha
branch: feat/x
commit: feat: first
hunk: h1
hunk: h2
hunk: h3
commit: feat: second (also uses h1)
hunk: h1

repo: /repo/beta
branch: main
commit: chore: beta
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => /duplicate|multiple/i.test(e) && e.includes("h1")));
	});

	it("reports unassigned hunks", () => {
		const ctxs = makeContexts();
		// h3 and h4 are not assigned
		const text = `
repo: /repo/alpha
branch: feat/x
commit: feat: partial
hunk: h1
hunk: h2

repo: /repo/beta
branch: main
commit: chore: nothing
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		const errStr = result.errors.join(" ");
		assert.ok(errStr.includes("h3") || errStr.includes("h4"), `expected unassigned hunk error, got: ${errStr}`);
	});

	it("reports empty commit message", () => {
		const ctxs = makeContexts();
		// "commit:" with nothing after it — empty message
		const text = `
repo: /repo/alpha
branch: feat/x
commit:
hunk: h1
hunk: h2
hunk: h3

repo: /repo/beta
branch: main
commit: chore: ok
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		// Parser should flag the empty commit message (may also flag other issues)
		assert.ok(!result.ok);
		// At least one error must mention "empty"
		const msgs = result.errors.join("\n");
		assert.ok(/empty/i.test(msgs), `expected an "empty" error, got:\n${msgs}`);
	});

	it("reports commit with no hunks", () => {
		const ctxs = makeContexts();
		const text = `
repo: /repo/alpha
branch: feat/x
commit: feat: no hunks here
commit: feat: real commit
hunk: h1
hunk: h2
hunk: h3

repo: /repo/beta
branch: main
commit: chore: ok
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => /no hunks/i.test(e)));
	});

	it("reports hunk assigned to wrong repo", () => {
		const ctxs = makeContexts();
		// h4 belongs to /repo/beta but is listed under /repo/alpha
		const text = `
repo: /repo/alpha
branch: feat/x
commit: feat: steals beta hunk
hunk: h1
hunk: h2
hunk: h3
hunk: h4

repo: /repo/beta
branch: main
commit: chore: empty — no hunks here
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		// Should report that h4 belongs to /repo/beta, not /repo/alpha
		const msgs = result.errors.join("\n");
		assert.ok(
			msgs.includes("h4") && msgs.includes("/repo/beta"),
			`expected cross-repo error for h4, got:\n${msgs}`,
		);
	});

	it("reports missing branch", () => {
		const ctxs = makeContexts();
		const text = `
repo: /repo/alpha
commit: feat: no branch
hunk: h1
hunk: h2
hunk: h3

repo: /repo/beta
branch: main
commit: chore: ok
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => /branch/i.test(e)));
	});

	it("reports unexpected line", () => {
		const ctxs = makeContexts();
		const text = `
repo: /repo/alpha
branch: feat/x
commit: feat: ok
hunk: h1
hunk: h2
hunk: h3
garbage line here

repo: /repo/beta
branch: main
commit: chore: ok
hunk: h4
`;
		const result = parseProposal(text, ctxs);
		assert.ok(!result.ok);
		assert.ok(result.errors.some((e) => /unexpected/i.test(e)));
	});
});

// ── Error display in re-opened editor ────────────────────────────────────────

describe("error recovery — prepending errors to proposal", () => {
	it("error prefix lines are all comments and are ignored on re-parse", () => {
		const ctxs = makeContexts();
		// Simulate a bad edit (h99 unknown)
		const badText = `
repo: /repo/alpha
branch: feat/x
commit: feat: foo
hunk: h1
hunk: h99

repo: /repo/beta
branch: main
commit: chore: ok
hunk: h2
hunk: h3
hunk: h4
`;
		const bad = parseProposal(badText, ctxs);
		assert.ok(!bad.ok);

		// Build the "re-open with errors" text
		const errorBlock = bad.errors.map((e) => `# ERROR: ${e}`).join("\n");
		const reopened = `${errorBlock}\n# Fix the errors above.\n\n${badText}`;

		// The error prefix is all comments, so parsing again gives the same structural errors
		const reparsed = parseProposal(reopened, ctxs);
		assert.ok(!reparsed.ok);
		// But it should still report h99 as unknown (same error)
		assert.ok(reparsed.errors.some((e) => e.includes("h99")));
	});
});
