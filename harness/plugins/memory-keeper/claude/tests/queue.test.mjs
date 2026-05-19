// Tests for the filesystem-backed event queue.
// All ops operate on the real queue location under ~/.claude/debug/memory-keeper-queue/,
// so each test tags its events with a unique session_id and cleans up at the end.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, unlinkSync, existsSync, renameSync } from "fs";
import { join } from "path";
import {
  enqueue,
  claimNext,
  complete,
  requeueOrFail,
  recoverProcessing,
  stats,
  ensureDirs,
  PENDING_DIR,
  PROCESSING_DIR,
  FAILED_DIR,
} from "../lib/queue.mjs";

const TAG_BASE = `queue-test-${process.pid}-${Date.now()}`;

function tag(suffix) {
  return `${TAG_BASE}-${suffix}`;
}

function fileBelongsToTest(path, tagSubstring) {
  try {
    return readFileSync(path, "utf8").includes(tagSubstring);
  } catch {
    return false;
  }
}

function cleanupAllTestFiles() {
  for (const dir of [PENDING_DIR, PROCESSING_DIR, FAILED_DIR]) {
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      const p = join(dir, name);
      if (fileBelongsToTest(p, TAG_BASE)) {
        try { unlinkSync(p); } catch {}
      }
    }
  }
}

before(() => ensureDirs());
after(() => cleanupAllTestFiles());

describe("queue.enqueue + claimNext (FIFO)", () => {
  it("claims oldest-first by filename timestamp", () => {
    const id1 = enqueue({ event_type: "user_prompt", session_id: tag("fifo-1"), payload: "first" });
    const id2 = enqueue({ event_type: "user_prompt", session_id: tag("fifo-2"), payload: "second" });
    assert.ok(id1 < id2, "later enqueue should have later id");

    // Skip past any pre-existing pending events from prior runs / real usage.
    let firstClaim;
    while (true) {
      const c = claimNext();
      assert.ok(c, "queue should not be empty");
      if (c.event.session_id === tag("fifo-1")) { firstClaim = c; break; }
      // Not ours — put it back via requeueOrFail with no error to preserve original retry_count.
      const errPath = c.processingPath;
      // We don't want to mutate other rows; just move back to pending.
      // requeueOrFail increments retry, which is wrong for foreign rows — use a manual rename instead.
      renameSync(errPath, join(PENDING_DIR, `${c.event.id}.json`));
    }
    assert.equal(firstClaim.event.session_id, tag("fifo-1"));
    complete(firstClaim.processingPath);

    // Now claim the second
    let secondClaim;
    while (true) {
      const c = claimNext();
      assert.ok(c);
      if (c.event.session_id === tag("fifo-2")) { secondClaim = c; break; }
      renameSync(c.processingPath, join(PENDING_DIR, `${c.event.id}.json`));
    }
    complete(secondClaim.processingPath);
  });
});

describe("queue.recoverProcessing", () => {
  it("moves orphaned files in processing/ back to pending/", () => {
    const id = enqueue({ event_type: "session_end", session_id: tag("recover-1"), payload: "x" });

    // Claim — file now lives in processing/
    let claim;
    while (true) {
      const c = claimNext();
      assert.ok(c);
      if (c.event.session_id === tag("recover-1")) { claim = c; break; }
      renameSync(c.processingPath, join(PENDING_DIR, `${c.event.id}.json`));
    }
    assert.ok(existsSync(claim.processingPath), "claimed file should exist in processing/");

    // Simulate crash — call recovery
    const n = recoverProcessing();
    assert.ok(n >= 1, "at least our orphan should be recovered");
    assert.ok(!existsSync(claim.processingPath), "processing copy should be gone");
    assert.ok(existsSync(join(PENDING_DIR, `${id}.json`)), "file should be back in pending/");

    // Clean up
    try { unlinkSync(join(PENDING_DIR, `${id}.json`)); } catch {}
  });
});

describe("queue.requeueOrFail", () => {
  it("requeues with incremented retry_count below threshold", () => {
    const id = enqueue({ event_type: "user_prompt", session_id: tag("retry-1"), payload: "x" });

    // Claim it
    let claim;
    while (true) {
      const c = claimNext();
      assert.ok(c);
      if (c.event.session_id === tag("retry-1")) { claim = c; break; }
      renameSync(c.processingPath, join(PENDING_DIR, `${c.event.id}.json`));
    }

    const r = requeueOrFail(claim.processingPath, claim.event, "simulated err", 5);
    assert.equal(r.terminal, false);

    const pendingPath = join(PENDING_DIR, `${id}.json`);
    assert.ok(existsSync(pendingPath));
    const reloaded = JSON.parse(readFileSync(pendingPath, "utf8"));
    assert.equal(reloaded.retry_count, 1);
    assert.equal(reloaded.error_message, "simulated err");

    try { unlinkSync(pendingPath); } catch {}
  });

  it("moves to failed/ when retry count reaches threshold", () => {
    const id = enqueue({ event_type: "user_prompt", session_id: tag("retry-2"), payload: "x" });

    let claim;
    while (true) {
      const c = claimNext();
      assert.ok(c);
      if (c.event.session_id === tag("retry-2")) { claim = c; break; }
      renameSync(c.processingPath, join(PENDING_DIR, `${c.event.id}.json`));
    }

    // maxRetries=1 → first failure is terminal
    const r = requeueOrFail(claim.processingPath, claim.event, "fatal err", 1);
    assert.equal(r.terminal, true);

    const failedPath = join(FAILED_DIR, `${id}.json`);
    assert.ok(existsSync(failedPath));
    assert.ok(!existsSync(join(PENDING_DIR, `${id}.json`)));

    try { unlinkSync(failedPath); } catch {}
  });
});

describe("queue.stats", () => {
  it("returns counts for pending/processing/failed", () => {
    const s = stats();
    assert.equal(typeof s.pending, "number");
    assert.equal(typeof s.processing, "number");
    assert.equal(typeof s.failed, "number");
  });
});
