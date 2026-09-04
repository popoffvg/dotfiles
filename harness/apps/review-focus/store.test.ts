import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readReviewed, writeReviewedFile } from "./store";

let stateHome: string;
const previousStateHome = process.env.XDG_STATE_HOME;

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "review-focus-store-test-"));
  process.env.XDG_STATE_HOME = stateHome;
});

afterEach(() => {
  rmSync(stateHome, { recursive: true, force: true });
  if (previousStateHome === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = previousStateHome;
});

test("a written reviewed state round-trips for its own repo only", () => {
  writeReviewedFile("/repo/a", "src/x.ts", { patchHash: "h1", hunks: [0, 2], fileReviewed: false });
  writeReviewedFile("/repo/b", "src/x.ts", { patchHash: "h9", hunks: [0], fileReviewed: true });

  expect(readReviewed("/repo/a")).toEqual({ "src/x.ts": { patchHash: "h1", hunks: [0, 2], fileReviewed: false } });
  expect(readReviewed("/repo/b")).toEqual({ "src/x.ts": { patchHash: "h9", hunks: [0], fileReviewed: true } });
});

test("writing null for a file removes only that file's entry", () => {
  writeReviewedFile("/repo/a", "src/x.ts", { patchHash: "h1", hunks: [0], fileReviewed: false });
  writeReviewedFile("/repo/a", "src/y.ts", { patchHash: "h2", hunks: [1], fileReviewed: true });

  writeReviewedFile("/repo/a", "src/x.ts", null);

  expect(readReviewed("/repo/a")).toEqual({ "src/y.ts": { patchHash: "h2", hunks: [1], fileReviewed: true } });
});

test("clearing the last file for a repo drops the repo entirely", () => {
  writeReviewedFile("/repo/a", "src/x.ts", { patchHash: "h1", hunks: [0], fileReviewed: false });
  writeReviewedFile("/repo/a", "src/x.ts", null);

  expect(readReviewed("/repo/a")).toEqual({});
});

test("a repo with no recorded state reads back empty, not an error", () => {
  expect(readReviewed("/repo/never-touched")).toEqual({});
});
