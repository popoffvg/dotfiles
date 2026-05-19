// Tests for the event-based worker (processEvent) and pure helpers.

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { processEvent } from "../worker/process-event.mjs";
import {
  saveInsight,
  deduplicateCheck,
  readActiveTask,
  extractHeadings,
  CLASSIFY_PROMPT,
} from "../worker/process-sessions.mjs";
import { PROMPT_CLASSIFY_PROMPT } from "../worker/prompts.mjs";

// --- Test helpers ---

function makeTmpDir() {
  const dir = join(tmpdir(), `mk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEvent(overrides = {}) {
  return {
    id: overrides.id ?? `${Date.now()}-test`,
    event_type: "session_end",
    session_id: `session-${Date.now()}`,
    cwd: "/tmp/test-project",
    project: "test-project",
    payload: "User: How do I fix the auth bug?\n\nAssistant: The issue is that JWT tokens expire silently. Add a refresh middleware.",
    retry_count: 0,
    ...overrides,
  };
}

/**
 * Mock generator. The classifier now expects a `{ long_term, daily }` envelope.
 * Tests may pass either:
 *  - the full envelope, or
 *  - a single long-term entry (auto-wrapped for back-compat with old tests).
 */
function mockGenerate(response, { expectPrompt = CLASSIFY_PROMPT } = {}) {
  const envelope = response && typeof response === "object" && ("long_term" in response || "daily" in response)
    ? response
    : (response && response.classification ? { long_term: [response], daily: [] } : { long_term: [], daily: [] });
  return async (opts) => {
    assert.ok(opts.prompt.startsWith(expectPrompt), "prompt should start with the expected classifier prompt");
    return { text: JSON.stringify(envelope) };
  };
}

const silentLog = () => {};

// --- session_end tests ---

describe("processEvent — session_end", () => {
  let tmpDir, insightsRoot;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    insightsRoot = join(tmpDir, "insights");
    mkdirSync(insightsRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("classifies insight and saves to project insights.md", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "insight",
      topic: "JWT silent expiry",
      body: "JWT tokens expire without error on 401 responses. Add refresh middleware.",
    });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    const insightsFile = join(insightsRoot, "test-project", "insights.md");
    assert.ok(existsSync(insightsFile), "insights.md should be created");
    const content = readFileSync(insightsFile, "utf8");
    assert.ok(content.includes("JWT silent expiry"));
    assert.ok(content.includes("JWT tokens expire without error"));
  });

  it("uses LLM-chosen repo instead of detected project", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "insight",
      repo: "pl",
      topic: "RocksDB WAL tuning",
      body: "Set fsync=true for RocksDB WAL to prevent corruption.",
    });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    assert.ok(existsSync(join(insightsRoot, "pl", "insights.md")), "should save to LLM-chosen repo dir");
    assert.ok(!existsSync(join(insightsRoot, "test-project", "insights.md")), "should NOT save to detected project dir");
  });

  it("returns without saving when classification is none", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({ classification: "none" });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    assert.ok(!existsSync(join(insightsRoot, "test-project", "insights.md")));
  });

  it("saves task to pending.md and creates task directory", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "task",
      topic: "Refactor auth module",
      body: "Break auth into separate JWT and session services.",
    });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    const pendingFile = join(insightsRoot, "_tasks", "pending.md");
    assert.ok(existsSync(pendingFile));
    const content = readFileSync(pendingFile, "utf8");
    assert.ok(content.includes("Refactor auth module"));
    assert.ok(content.includes("**Status**: active"));
    assert.ok(existsSync(join(insightsRoot, "_tasks", "refactor-auth-module")), "task directory should be created");
  });

  it("saves agent_edit to behavior.md", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "agent_edit",
      topic: "Use concise responses",
      body: "User prefers short answers without preamble.",
    });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    const behaviorFile = join(insightsRoot, "claude-config", "behavior.md");
    assert.ok(existsSync(behaviorFile));
    assert.ok(readFileSync(behaviorFile, "utf8").includes("Use concise responses"));
  });

  it("throws on invalid LLM JSON (so daemon can requeue)", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = async () => ({ text: "this is not valid json at all" });

    await assert.rejects(
      () => processEvent({ event, model: "mock", config, generate, log: silentLog }),
      /JSON|Unexpected/i
    );
  });

  it("propagates generate() throws (so daemon can requeue)", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = async () => { throw new Error("API rate limit exceeded"); };

    await assert.rejects(
      () => processEvent({ event, model: "mock", config, generate, log: silentLog }),
      /rate limit/
    );
  });

  it("handles LLM response wrapped in markdown fences", async () => {
    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = async () => ({
      text: '```json\n{"classification":"insight","topic":"Fenced response","body":"LLM wrapped response."}\n```',
    });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });
    assert.ok(existsSync(join(insightsRoot, "test-project", "insights.md")));
  });

  it("passes existing headings to LLM prompt for dedup", async () => {
    const projDir = join(insightsRoot, "test-project");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "insights.md"), "## JWT silent expiry — 2026-03-11\n- Old fact\n");

    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    let capturedPrompt = "";
    const generate = async ({ prompt }) => {
      capturedPrompt = prompt;
      return { text: JSON.stringify([{ classification: "insight", topic: "New topic", body: "A new discovery." }]) };
    };

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    assert.ok(capturedPrompt.includes("Existing topics"), "prompt should contain existing topics block");
    assert.ok(capturedPrompt.includes("JWT silent expiry"), "prompt should list existing heading");
  });

  it("routes insight to active task when one exists", async () => {
    const tasksDir = join(insightsRoot, "_tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, "pending.md"),
      "## Fix auth flow\n- **Status**: active\n- **Repos**: test-project\n"
    );

    const event = makeEvent();
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({
      classification: "insight",
      topic: "Token refresh edge case",
      body: "Refresh token can race with concurrent requests.",
    });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    const taskNotes = join(tasksDir, "fix-auth-flow", "notes.md");
    assert.ok(existsSync(taskNotes), "task notes.md should exist");
    assert.ok(readFileSync(taskNotes, "utf8").includes("Token refresh edge case"));
    assert.ok(!existsSync(join(insightsRoot, "test-project", "insights.md")), "should NOT save to project insights when task active");
  });
});

// --- user_prompt tests ---

describe("processEvent — user_prompt", () => {
  let tmpDir, insightsRoot;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    insightsRoot = join(tmpDir, "insights");
    mkdirSync(insightsRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses the short PROMPT_CLASSIFY_PROMPT for user prompts", async () => {
    const event = makeEvent({
      event_type: "user_prompt",
      payload: "let's rewrite the plugin to use a daemon and a queue",
    });
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate(
      { classification: "agent_edit", repo: "memory-keeper", topic: "Daemon-based queue rewrite", body: "Switch to filesystem queue + long-running daemon." },
      { expectPrompt: PROMPT_CLASSIFY_PROMPT }
    );

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    const behaviorFile = join(insightsRoot, "claude-config", "behavior.md");
    assert.ok(existsSync(behaviorFile));
    assert.ok(readFileSync(behaviorFile, "utf8").includes("Daemon-based queue rewrite"));
  });

  it("does nothing when payload is empty", async () => {
    const event = makeEvent({ event_type: "user_prompt", payload: "" });
    const config = { insights_root: insightsRoot };
    let called = false;
    const generate = async () => { called = true; return { text: "{}" }; };

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    assert.equal(called, false, "generate should not be called for empty payload");
  });

  it("classification=none produces no file writes", async () => {
    const event = makeEvent({
      event_type: "user_prompt",
      payload: "show me the contents of foo.txt",
    });
    const config = { insights_root: insightsRoot };
    const generate = mockGenerate({ classification: "none" }, { expectPrompt: PROMPT_CLASSIFY_PROMPT });

    await processEvent({ event, model: "mock", config, generate, log: silentLog });

    assert.ok(!existsSync(join(insightsRoot, "claude-config", "behavior.md")));
  });
});

// --- Pure helper tests (unchanged behavior) ---

describe("deduplicateCheck", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

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
    assert.equal(deduplicateCheck(f, "Refined facts field rules"), true);
  });

  it("detects reverse substring match", () => {
    const f = join(tmpDir, "insights.md");
    writeFileSync(f, "## hooks — 2026-03-04\n");
    assert.equal(deduplicateCheck(f, "hooks"), true);
  });
});

describe("extractHeadings", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

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
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

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

describe("saveInsight", () => {
  let tmpDir, insightsRoot;
  beforeEach(() => {
    tmpDir = makeTmpDir();
    insightsRoot = join(tmpDir, "insights");
    mkdirSync(insightsRoot, { recursive: true });
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("returns null when an existing heading matches (dedup)", () => {
    const projDir = join(insightsRoot, "p");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "insights.md"), "## Topic A — 2026-01-01 00:00\nbody\n");
    const result = saveInsight({ insights_root: insightsRoot }, "p", "insight", "Topic A", "new body");
    assert.equal(result, null);
  });

  it("writes a new insight to <project>/insights.md", () => {
    const result = saveInsight({ insights_root: insightsRoot }, "p", "insight", "Brand new", "body line");
    assert.ok(result?.endsWith("insights.md"));
    assert.ok(readFileSync(result, "utf8").includes("Brand new"));
  });
});
