import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import {
  processSession,
  saveInsight,
  deduplicateCheck,
  readActiveTask,
  extractHeadings,
  CLASSIFY_PROMPT,
} from "../worker/process-sessions.mjs";

// --- Test helpers ---

function makeTmpDir() {
  const dir = join(tmpdir(), `mk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeTestDb(dir) {
  const db = new Database(join(dir, "test.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      cwd TEXT,
      project TEXT,
      conversation TEXT,
      status TEXT DEFAULT 'pending',
      classification TEXT,
      insight_text TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    )
  `);
  return db;
}

function insertSession(db, overrides = {}) {
  const defaults = {
    session_id: `test-${Date.now()}`,
    cwd: "/tmp/test-project",
    project: "test-project",
    conversation: "User: How do I fix the auth bug?\n\nAssistant: The issue is that JWT tokens expire silently. Add a refresh middleware.",
    retry_count: 0,
    status: "pending",
  };
  const s = { ...defaults, ...overrides };
  db.prepare(
    "INSERT INTO sessions (session_id, cwd, project, conversation, status, retry_count, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(s.session_id, s.cwd, s.project, s.conversation, s.status, s.retry_count, s.error_message || null);
  return db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(s.session_id);
}

/**
 * Mock generate function — returns a canned LLM response.
 */
function mockGenerate(response) {
  return async (opts) => {
    // Verify prompt structure
    assert.ok(opts.prompt.startsWith(CLASSIFY_PROMPT), "prompt should start with CLASSIFY_PROMPT");
    assert.ok(opts.prompt.includes("[Project:"), "prompt should include project metadata");
    return { text: JSON.stringify(response) };
  };
}

// --- Tests ---

describe("processSession", () => {
  let tmpDir, db, insightsRoot;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    db = makeTestDb(tmpDir);
    insightsRoot = join(tmpDir, "insights");
    mkdirSync(insightsRoot, { recursive: true });
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("classifies insight and saves to project insights.md", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "insight",
      topic: "JWT silent expiry",
      body: "JWT tokens expire without error on 401 responses. Add refresh middleware to catch silent expiry and re-authenticate transparently.",
    });

    await processSession(db, session, "mock-model", config, { generate });

    // Session deleted after success
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row, undefined, "processed session should be deleted from DB");

    const insightsFile = join(insightsRoot, "test-project", "insights.md");
    assert.ok(existsSync(insightsFile), "insights.md should be created");
    const content = readFileSync(insightsFile, "utf8");
    assert.ok(content.includes("JWT silent expiry"));
    assert.ok(content.includes("JWT tokens expire without error"));
  });

  it("uses LLM-chosen repo instead of detected project", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "insight",
      repo: "pl",
      topic: "RocksDB WAL tuning",
      body: "Set `fsync=true` for RocksDB WAL on ext4 to prevent corruption after power loss.",
    });

    await processSession(db, session, "mock-model", config, { generate });

    // Should save to LLM-chosen "pl" dir, not detected "test-project"
    const insightsFile = join(insightsRoot, "pl", "insights.md");
    assert.ok(existsSync(insightsFile), "should save to LLM-chosen repo dir");
    const content = readFileSync(insightsFile, "utf8");
    const wrongFile = join(insightsRoot, "test-project", "insights.md");
    assert.ok(!existsSync(wrongFile), "should NOT save to detected project dir");
  });

  it("deletes session classified as none", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "none",
      topic: "routine",
      body: "",
    });

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row, undefined, "skipped session should be deleted from DB");
  });

  it("saves task to pending.md and creates task directory", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "task",
      topic: "Refactor auth module",
      body: "Break auth into separate JWT and session services. Current auth.go is 800 lines with mixed concerns.",
    });

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row, undefined, "processed session should be deleted from DB");

    const pendingFile = join(insightsRoot, "_tasks", "pending.md");
    assert.ok(existsSync(pendingFile));
    const content = readFileSync(pendingFile, "utf8");
    assert.ok(content.includes("Refactor auth module"));
    assert.ok(content.includes("**Status**: active"));
    assert.ok(content.includes("Break auth into separate JWT"));

    const taskDir = join(insightsRoot, "_tasks", "refactor-auth-module");
    assert.ok(existsSync(taskDir), "task directory should be created");
  });

  it("saves agent_edit to behavior.md", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "agent_edit",
      topic: "Use concise responses",
      body: "User prefers short answers without preamble. Skip re-proposals when corrected — act immediately.",
    });

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row, undefined, "processed session should be deleted");

    const behaviorFile = join(insightsRoot, "claude-config", "behavior.md");
    assert.ok(existsSync(behaviorFile));
    const content = readFileSync(behaviorFile, "utf8");
    assert.ok(content.includes("Use concise responses"));
    assert.ok(content.includes("User prefers short answers"));
  });

  it("increments retry_count on LLM error and keeps pending", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = async () => ({ text: "this is not valid json at all" });

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row.status, "pending", "should stay pending for retry");
    assert.equal(row.retry_count, 1);
    assert.ok(row.error_message, "should have error message");
  });

  it("increments retry_count on LLM throw and keeps pending", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = async () => {
      throw new Error("API rate limit exceeded");
    };

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row.status, "pending");
    assert.equal(row.retry_count, 1);
    assert.ok(row.error_message.includes("rate limit"));
  });

  it("drops session after MAX_RETRIES (5) attempts", async () => {
    const session = insertSession(db, {
      retry_count: 4,
      error_message: "previous error",
    });
    const config = { insights_root: insightsRoot };
    const generate = async () => {
      throw new Error("still failing");
    };

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row.status, "dropped");
    assert.equal(row.retry_count, 5);
    assert.ok(row.error_message.includes("still failing"));
  });

  it("drops session immediately if retry_count already >= MAX_RETRIES", async () => {
    const session = insertSession(db, {
      retry_count: 5,
      error_message: "old error",
    });
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({ classification: "insight", topic: "X", body: "Y" });

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row.status, "dropped");
    assert.ok(row.error_message.includes("5 failed attempts"));
  });

  it("handles LLM response wrapped in markdown fences", async () => {
    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = async () => ({
      text: '```json\n{"classification":"insight","topic":"Fenced response","body":"LLM wrapped response in markdown fences."}\n```',
    });

    await processSession(db, session, "mock-model", config, { generate });

    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
    assert.equal(row, undefined, "processed session should be deleted");
  });

  it("passes existing headings to LLM prompt for dedup", async () => {
    // Pre-populate an existing insight
    const projDir = join(insightsRoot, "test-project");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "insights.md"), "## JWT silent expiry — 2026-03-11\n- Old fact\n");

    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    let capturedPrompt = "";
    const generate = async ({ prompt }) => {
      capturedPrompt = prompt;
      return { text: JSON.stringify([{ classification: "insight", topic: "New topic", body: "A new discovery." }]) };
    };

    await processSession(db, session, "mock-model", config, { generate });

    assert.ok(capturedPrompt.includes("Existing topics"), "prompt should contain existing topics block");
    assert.ok(capturedPrompt.includes("JWT silent expiry"), "prompt should list existing heading");
  });

  it("routes insight to active task when one exists", async () => {
    // Create an active task
    const tasksDir = join(insightsRoot, "_tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, "pending.md"),
      "## Fix auth flow\n- **Status**: active\n- **Repos**: test-project\n"
    );

    const session = insertSession(db);
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "insight",
      topic: "Token refresh edge case",
      body: "Refresh token can race with concurrent requests. Use mutex to serialize token refresh calls.",
    });

    await processSession(db, session, "mock-model", config, { generate });

    // Should go to task notes, not project insights
    const taskNotes = join(tasksDir, "fix-auth-flow", "notes.md");
    assert.ok(existsSync(taskNotes), "notes.md should exist in task dir");
    const content = readFileSync(taskNotes, "utf8");
    assert.ok(content.includes("Token refresh edge case"));

    const projectInsights = join(insightsRoot, "test-project", "insights.md");
    assert.ok(!existsSync(projectInsights), "should NOT save to project insights when task is active");
  });
});

describe("deduplicateCheck", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false for non-existent file", () => {
    assert.equal(deduplicateCheck(join(tmpDir, "nope.md"), "anything"), false);
  });

  it("detects exact topic heading match", () => {
    const f = join(tmpDir, "insights.md");
    writeFileSync(f, "## JWT silent expiry — 2026-03-11\nSome text\n");
    assert.equal(deduplicateCheck(f, "JWT silent expiry"), true);
  });

  it("detects case-insensitive match", () => {
    const f = join(tmpDir, "insights.md");
    writeFileSync(f, "## jwt SILENT Expiry — 2026-03-11\nSome text\n");
    assert.equal(deduplicateCheck(f, "JWT silent expiry"), true);
  });

  it("returns false for different topic", () => {
    const f = join(tmpDir, "insights.md");
    writeFileSync(f, "## Auth middleware setup — 2026-03-11\n");
    assert.equal(deduplicateCheck(f, "JWT silent expiry"), false);
  });

  it("detects word-overlap duplicate (>70% shared words)", () => {
    const f = join(tmpDir, "insights.md");
    writeFileSync(f, "## Refined facts field requirements — 2026-03-11\n");
    assert.equal(deduplicateCheck(f, "Refining fact extraction rules"), false);
    // But very similar rephrasing should match
    assert.equal(deduplicateCheck(f, "Refined facts field rules"), true);
  });

  it("detects reverse substring match", () => {
    const f = join(tmpDir, "insights.md");
    writeFileSync(f, "## hooks — 2026-03-04\n");
    // Longer topic that contains the existing heading
    assert.equal(deduplicateCheck(f, "hooks"), true);
  });
});

describe("extractHeadings", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for non-existent file", () => {
    assert.deepEqual(extractHeadings(join(tmpDir, "nope.md")), []);
  });

  it("extracts headings without date suffix", () => {
    const f = join(tmpDir, "test.md");
    writeFileSync(f, "## JWT expiry — 2026-03-11\ntext\n## Auth flow\ntext\n## Config fix — 2026-03-12 15:30\n");
    assert.deepEqual(extractHeadings(f), ["JWT expiry", "Auth flow", "Config fix"]);
  });
});

describe("readActiveTask", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no pending.md exists", () => {
    assert.equal(readActiveTask(tmpDir), null);
  });

  it("returns null when no active task", () => {
    const tasksDir = join(tmpDir, "_tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "pending.md"), "## Old task\n- **Status**: done\n");
    assert.equal(readActiveTask(tmpDir), null);
  });

  it("returns active task title and slug", () => {
    const tasksDir = join(tmpDir, "_tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, "pending.md"),
      "## Refactor Auth Module\n- **Status**: active\n- **Repos**: pl\n"
    );
    const task = readActiveTask(tmpDir);
    assert.deepEqual(task, { title: "Refactor Auth Module", slug: "refactor-auth-module" });
  });
});
