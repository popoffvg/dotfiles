import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseUnifiedDiff, buildPatch } from "../diff.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SIMPLE_DIFF = `\
diff --git a/server.go b/server.go
index abc123..def456 100644
--- a/server.go
+++ b/server.go
@@ -10,6 +10,8 @@ func Foo() {
 unchanged
+added line A
 unchanged
-removed line
 unchanged
@@ -50,4 +52,4 @@ func Bar() {
 unchanged
-old line
+new line
 unchanged
`;

const NEW_FILE_DIFF = `\
diff --git a/health.go b/health.go
new file mode 100644
index 0000000..aabbcc
--- /dev/null
+++ b/health.go
@@ -0,0 +1,5 @@
+package main
+
+func Health() bool {
+	return true
+}
`;

const DELETED_FILE_DIFF = `\
diff --git a/old.go b/old.go
deleted file mode 100644
index aabbcc..0000000
--- a/old.go
+++ /dev/null
@@ -1,3 +0,0 @@
-package main
-
-func Old() {}
`;

const MULTI_FILE_DIFF = `\
diff --git a/a.go b/a.go
index 111..222 100644
--- a/a.go
+++ b/a.go
@@ -1,3 +1,4 @@
 package main
+// new comment
 func A() {}
diff --git a/b.go b/b.go
index 333..444 100644
--- a/b.go
+++ b/b.go
@@ -5,3 +5,4 @@ func B1() {}
 // context
+func B2() {}
 func B3() {}
@@ -20,3 +21,3 @@ func B4() {}
 // context
-old
+new
 // context
`;

// ── parseUnifiedDiff ──────────────────────────────────────────────────────────

describe("parseUnifiedDiff", () => {
	it("parses a single file with two hunks", () => {
		const result = parseUnifiedDiff(SIMPLE_DIFF);
		assert.equal(result.files.length, 1);
		assert.equal(result.hunks.length, 2);
		assert.equal(result.files[0].file, "server.go");
		assert.equal(result.files[0].isNewFile, false);
		assert.equal(result.files[0].isDeletedFile, false);
	});

	it("assigns sequential hunk IDs starting at h1", () => {
		const result = parseUnifiedDiff(SIMPLE_DIFF);
		assert.equal(result.hunks[0].id, "h1");
		assert.equal(result.hunks[1].id, "h2");
	});

	it("counts added and removed lines correctly", () => {
		const result = parseUnifiedDiff(SIMPLE_DIFF);
		const h1 = result.hunks[0];
		assert.equal(h1.addedLines, 1);
		assert.equal(h1.removedLines, 1);
		const h2 = result.hunks[1];
		assert.equal(h2.addedLines, 1);
		assert.equal(h2.removedLines, 1);
	});

	it("detects new files", () => {
		const result = parseUnifiedDiff(NEW_FILE_DIFF);
		assert.equal(result.files.length, 1);
		assert.equal(result.files[0].file, "health.go");
		assert.equal(result.files[0].isNewFile, true);
		assert.equal(result.files[0].isDeletedFile, false);
		assert.equal(result.hunks[0].isNewFile, true);
		assert.equal(result.hunks[0].addedLines, 5);
	});

	it("detects deleted files", () => {
		const result = parseUnifiedDiff(DELETED_FILE_DIFF);
		assert.equal(result.files.length, 1);
		assert.equal(result.files[0].file, "old.go");
		assert.equal(result.files[0].isDeletedFile, true);
		assert.equal(result.hunks[0].isDeletedFile, true);
		assert.equal(result.hunks[0].removedLines, 3);
	});

	it("parses multiple files and accumulates hunks in order", () => {
		const result = parseUnifiedDiff(MULTI_FILE_DIFF);
		assert.equal(result.files.length, 2);
		assert.equal(result.hunks.length, 3);
		assert.equal(result.hunks[0].file, "a.go");
		assert.equal(result.hunks[1].file, "b.go");
		assert.equal(result.hunks[2].file, "b.go");
		// IDs are assigned in document order
		assert.equal(result.hunks[0].id, "h1");
		assert.equal(result.hunks[1].id, "h2");
		assert.equal(result.hunks[2].id, "h3");
	});

	it("populates hunkMap with all hunk IDs", () => {
		const result = parseUnifiedDiff(MULTI_FILE_DIFF);
		assert.equal(result.hunkMap.size, 3);
		assert.ok(result.hunkMap.has("h1"));
		assert.ok(result.hunkMap.has("h2"));
		assert.ok(result.hunkMap.has("h3"));
	});

	it("captures a snippet of changed lines", () => {
		const result = parseUnifiedDiff(SIMPLE_DIFF);
		assert.ok(result.hunks[0].snippet.length > 0);
		// Snippet contains only + or - lines
		for (const line of result.hunks[0].snippet.split("\n")) {
			assert.ok(line.startsWith("+") || line.startsWith("-"), `unexpected snippet line: "${line}"`);
		}
	});

	it("returns empty result for empty input", () => {
		const result = parseUnifiedDiff("");
		assert.equal(result.files.length, 0);
		assert.equal(result.hunks.length, 0);
	});

	it("header includes file header lines, not hunk content", () => {
		const result = parseUnifiedDiff(SIMPLE_DIFF);
		const fh = result.files[0].fileHeader;
		assert.ok(fh.includes("diff --git"));
		assert.ok(!fh.includes("+added line A"));
	});
});

// ── buildPatch ────────────────────────────────────────────────────────────────

describe("buildPatch", () => {
	it("selects all hunks → reproduces the original diff (structurally)", () => {
		const parsed = parseUnifiedDiff(MULTI_FILE_DIFF);
		const allIds = new Set(parsed.hunks.map((h) => h.id));
		const patch = buildPatch(parsed.files, allIds);
		// Both files should be present
		assert.ok(patch.includes("diff --git a/a.go"));
		assert.ok(patch.includes("diff --git a/b.go"));
		// All three @@ blocks should be present
		const atCount = (patch.match(/^@@/gm) || []).length;
		assert.equal(atCount, 3);
	});

	it("selects a subset of hunks from one file", () => {
		const parsed = parseUnifiedDiff(MULTI_FILE_DIFF);
		// Only h2 (first hunk in b.go)
		const patch = buildPatch(parsed.files, new Set(["h2"]));
		assert.ok(!patch.includes("diff --git a/a.go"), "a.go should be absent");
		assert.ok(patch.includes("diff --git a/b.go"));
		const atCount = (patch.match(/^@@/gm) || []).length;
		assert.equal(atCount, 1);
	});

	it("returns empty string when no hunks selected", () => {
		const parsed = parseUnifiedDiff(MULTI_FILE_DIFF);
		const patch = buildPatch(parsed.files, new Set());
		assert.equal(patch, "");
	});

	it("handles new file hunk", () => {
		const parsed = parseUnifiedDiff(NEW_FILE_DIFF);
		const patch = buildPatch(parsed.files, new Set(["h1"]));
		assert.ok(patch.includes("new file mode"));
		assert.ok(patch.includes("+++ b/health.go"));
	});

	it("handles deleted file hunk", () => {
		const parsed = parseUnifiedDiff(DELETED_FILE_DIFF);
		const patch = buildPatch(parsed.files, new Set(["h1"]));
		assert.ok(patch.includes("deleted file mode"));
		assert.ok(patch.includes("--- a/old.go"));
	});

	it("hunks end with newline (no bleeding)", () => {
		const parsed = parseUnifiedDiff(MULTI_FILE_DIFF);
		const allIds = new Set(parsed.hunks.map((h) => h.id));
		const patch = buildPatch(parsed.files, allIds);
		assert.ok(patch.endsWith("\n"), "patch should end with newline");
	});
});
