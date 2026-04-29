import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  findSessionJsonl,
  extractConversation,
  detectProject,
} from "../hooks/stop-capture.mjs";

function makeTmpDir() {
  const dir = join(tmpdir(), `mk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("findSessionJsonl", () => {
  it("returns null when session ID does not match any file", () => {
    const result = findSessionJsonl("nonexistent-session-id-12345");
    assert.equal(result, null);
  });

  it("returns null for empty session ID", () => {
    const result = findSessionJsonl("");
    assert.equal(result, null);
  });

  it("returns null for undefined session ID", () => {
    const result = findSessionJsonl(undefined);
    assert.equal(result, null);
  });
});

describe("extractConversation", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts user and assistant messages from JSONL", () => {
    const jsonlPath = join(tmpDir, "session.jsonl");
    const lines = [
      JSON.stringify({ type: "user", message: { content: "Hello, how are you?" } }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "I'm doing well!" }] },
      }),
      JSON.stringify({ type: "user", message: { content: "Fix the auth bug" } }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Done, the JWT expiry is now handled." }] },
      }),
    ];
    writeFileSync(jsonlPath, lines.join("\n"));

    const result = extractConversation(jsonlPath);
    assert.ok(result.includes("User: Hello, how are you?"));
    assert.ok(result.includes("Assistant: I'm doing well!"));
    assert.ok(result.includes("User: Fix the auth bug"));
    assert.ok(result.includes("Assistant: Done, the JWT expiry is now handled."));
  });

  it("skips system/command/local messages", () => {
    const jsonlPath = join(tmpDir, "session.jsonl");
    const lines = [
      JSON.stringify({ type: "user", message: { content: "<system-reminder>ignore</system-reminder>" } }),
      JSON.stringify({ type: "user", message: { content: "<command-name>/clear</command-name>" } }),
      JSON.stringify({ type: "user", message: { content: "<local-command>something</local-command>" } }),
      JSON.stringify({ type: "user", message: { content: "Real user message" } }),
    ];
    writeFileSync(jsonlPath, lines.join("\n"));

    const result = extractConversation(jsonlPath);
    assert.ok(!result.includes("ignore"));
    assert.ok(!result.includes("clear"));
    assert.ok(!result.includes("local-command"));
    assert.ok(result.includes("Real user message"));
  });

  it("handles assistant content as plain string", () => {
    const jsonlPath = join(tmpDir, "session.jsonl");
    const lines = [
      JSON.stringify({ type: "assistant", message: { content: "Plain string response" } }),
    ];
    writeFileSync(jsonlPath, lines.join("\n"));

    const result = extractConversation(jsonlPath);
    assert.ok(result.includes("Plain string response"));
  });

  it("respects MAX_CONVERSATION_CHARS budget (takes last messages)", () => {
    const jsonlPath = join(tmpDir, "session.jsonl");
    const longMsg = "A".repeat(5000);
    const lines = [
      JSON.stringify({ type: "user", message: { content: longMsg } }),
      JSON.stringify({ type: "user", message: { content: "Short final message" } }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Short reply" }] },
      }),
    ];
    writeFileSync(jsonlPath, lines.join("\n"));

    const result = extractConversation(jsonlPath);
    // Should include the short messages but not the 5000-char one (budget is 8000)
    assert.ok(result.includes("Short final message"));
    assert.ok(result.includes("Short reply"));
  });

  it("returns empty string for empty JSONL file", () => {
    const jsonlPath = join(tmpDir, "empty.jsonl");
    writeFileSync(jsonlPath, "");

    const result = extractConversation(jsonlPath);
    assert.equal(result, "");
  });

  it("handles malformed JSON lines gracefully", () => {
    const jsonlPath = join(tmpDir, "bad.jsonl");
    const lines = [
      "not json at all",
      JSON.stringify({ type: "user", message: { content: "Valid message" } }),
      "{broken json",
    ];
    writeFileSync(jsonlPath, lines.join("\n"));

    const result = extractConversation(jsonlPath);
    assert.ok(result.includes("Valid message"));
  });
});

describe("detectProject", () => {
  it("returns 'unknown' for empty cwd", () => {
    assert.equal(detectProject(""), "unknown");
  });

  it("returns 'unknown' for null cwd", () => {
    assert.equal(detectProject(null), "unknown");
  });

  it("returns basename for non-git directory", () => {
    const result = detectProject("/tmp/some-random-dir");
    assert.equal(result, "some-random-dir");
  });
});
