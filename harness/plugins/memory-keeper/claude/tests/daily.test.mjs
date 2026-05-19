// Tests for the ephemeral daily-memory layer.

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { appendDailyFact, pruneOldDaily, dailyDir } from "../lib/daily.mjs";

function makeTmpRoot() {
  const dir = join(tmpdir(), `mk-daily-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const FIXED_NOW = new Date("2026-05-17T14:23:00Z");
function dailyPath(root, date) {
  return join(dailyDir(root), `${date}.md`);
}

describe("appendDailyFact", () => {
  let root;
  beforeEach(() => { root = makeTmpRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it("creates the daily file with a heading and a theme section", () => {
    const p = appendDailyFact(root, ["Auth"], "JWT refresh middleware drafted in auth/refresh.go", { now: FIXED_NOW });
    assert.equal(p, dailyPath(root, "2026-05-17"));
    const content = readFileSync(p, "utf8");
    assert.ok(content.startsWith("# Daily memory — 2026-05-17"));
    assert.ok(content.includes("## Auth"));
    assert.ok(content.includes("- 14:23 JWT refresh middleware drafted in auth/refresh.go"));
  });

  it("appends to an existing theme section without creating duplicates", () => {
    appendDailyFact(root, ["Auth"], "first fact", { now: FIXED_NOW });
    appendDailyFact(root, ["Auth"], "second fact", { now: FIXED_NOW });
    const content = readFileSync(dailyPath(root, "2026-05-17"), "utf8");
    const authHeadings = (content.match(/^## Auth\s*$/gm) || []).length;
    assert.equal(authHeadings, 1, "should keep a single ## Auth heading");
    assert.ok(content.includes("first fact"));
    assert.ok(content.includes("second fact"));
  });

  it("creates a new section for an unknown theme without touching existing ones", () => {
    appendDailyFact(root, ["Auth"], "auth fact", { now: FIXED_NOW });
    appendDailyFact(root, ["CI/CD"], "ci fact", { now: FIXED_NOW });
    const content = readFileSync(dailyPath(root, "2026-05-17"), "utf8");
    assert.ok(content.includes("## Auth"));
    assert.ok(content.includes("## CI/CD"));
    assert.ok(content.indexOf("## Auth") < content.indexOf("## CI/CD"), "Auth section should come first");
  });

  it("supports multiple themes per fact (writes the bullet under each)", () => {
    appendDailyFact(root, ["Auth", "Bug"], "JWT silent expiry on 401", { now: FIXED_NOW });
    const content = readFileSync(dailyPath(root, "2026-05-17"), "utf8");
    assert.ok(content.match(/## Auth\n- 14:23 JWT silent expiry/));
    assert.ok(content.match(/## Bug\n- 14:23 JWT silent expiry/));
  });

  it("clamps to 3 themes max", () => {
    appendDailyFact(root, ["A", "B", "C", "D", "E"], "many themes", { now: FIXED_NOW });
    const content = readFileSync(dailyPath(root, "2026-05-17"), "utf8");
    assert.ok(content.includes("## A"));
    assert.ok(content.includes("## B"));
    assert.ok(content.includes("## C"));
    assert.ok(!content.includes("## D"));
  });

  it("defaults to ['Misc'] when no theme is given", () => {
    appendDailyFact(root, [], "no theme", { now: FIXED_NOW });
    const content = readFileSync(dailyPath(root, "2026-05-17"), "utf8");
    assert.ok(content.includes("## Misc"));
  });

  it("returns null for empty fact", () => {
    assert.equal(appendDailyFact(root, ["X"], "   "), null);
    assert.equal(appendDailyFact(root, ["X"], null), null);
  });
});

describe("pruneOldDaily", () => {
  let root;
  beforeEach(() => {
    root = makeTmpRoot();
    mkdirSync(dailyDir(root), { recursive: true });
  });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it("keeps today + yesterday, removes the rest", () => {
    writeFileSync(dailyPath(root, "2026-05-17"), "# today");      // FIXED_NOW
    writeFileSync(dailyPath(root, "2026-05-16"), "# yesterday");
    writeFileSync(dailyPath(root, "2026-05-15"), "# older");
    writeFileSync(dailyPath(root, "2026-05-10"), "# much older");

    const removed = pruneOldDaily(root, { keepDays: 2, now: FIXED_NOW });
    assert.equal(removed.length, 2);

    assert.ok(existsSync(dailyPath(root, "2026-05-17")));
    assert.ok(existsSync(dailyPath(root, "2026-05-16")));
    assert.ok(!existsSync(dailyPath(root, "2026-05-15")));
    assert.ok(!existsSync(dailyPath(root, "2026-05-10")));
  });

  it("ignores non-date filenames", () => {
    writeFileSync(dailyPath(root, "2026-05-10"), "# old");
    writeFileSync(join(dailyDir(root), "README.md"), "# readme");
    pruneOldDaily(root, { keepDays: 2, now: FIXED_NOW });
    assert.ok(existsSync(join(dailyDir(root), "README.md")), "non-date files left alone");
  });

  it("is a no-op when _daily/ doesn't exist", () => {
    const fresh = makeTmpRoot();
    const removed = pruneOldDaily(fresh, { keepDays: 2, now: FIXED_NOW });
    assert.deepEqual(removed, []);
    rmSync(fresh, { recursive: true, force: true });
  });
});
