import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  awaitResult,
  dropResult,
  lastSession,
  markClosed,
  markOpen,
  newSessionId,
  openSessions,
  readResult,
  uncollectedResults,
  writeResult,
} from "../src/session.js";

const run = promisify(execFile);
const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(appDir, "bin", "mdshow.js");
const sample = join(appDir, "test", "fixtures", "sample.md");
const plan = join(appDir, "test", "fixtures", "plan.md");

test("a result written by the window process is readable by a later waiter", async () => {
  const id = newSessionId();
  writeResult(id, { cancelled: false, feedback: "change line 3" });

  assert.deepEqual(readResult(id), { cancelled: false, feedback: "change line 3" });
  assert.deepEqual(await awaitResult(id, 50), { cancelled: false, feedback: "change line 3" });

  dropResult(id);
  assert.equal(readResult(id), null);
});

test("awaitResult gives up at the deadline instead of hanging", async () => {
  const started = Date.now();
  const result = await awaitResult(newSessionId(), 300, 50);

  assert.equal(result, null);
  assert.ok(Date.now() - started >= 300);
});

test("awaitResult returns a result that appears while it waits", async () => {
  const id = newSessionId();
  setTimeout(() => writeResult(id, { cancelled: true, feedback: "closed" }), 120);

  const result = await awaitResult(id, 3000, 50);

  assert.equal(result.feedback, "closed");
  dropResult(id);
});

test("wait with --seconds reports the window as still open, exit 0", async () => {
  const { stdout } = await run(process.execPath, [cli, "wait", "nosuch", "--seconds", "1"]);

  assert.match(stdout, /has not sent feedback yet \(waited 1s\)/);
  assert.match(stdout, /mdshow wait nosuch/);
});

test("wait --last picks the newest open window", async () => {
  const older = newSessionId();
  const newer = newSessionId();
  markOpen(older, "old.md");
  await new Promise((resume) => setTimeout(resume, 20));
  markOpen(newer, "new.md");

  assert.equal(openSessions()[0], newer);

  writeResult(newer, { cancelled: false, feedback: "from the newest window" });
  const { stdout } = await run(process.execPath, [cli, "wait", "--last"]);

  assert.match(stdout, /from the newest window/);
  markClosed(older);
  markClosed(newer);
});

test("wait --last with no open window says so instead of hanging", async () => {
  for (const id of openSessions()) markClosed(id);
  for (const id of uncollectedResults()) dropResult(id);

  const { stdout } = await run(process.execPath, [cli, "wait", "--last"]);

  assert.match(stdout, /No review window is open/);
});

test("wait --last collects a result left behind when the caller was killed", async () => {
  // The reader submitted, the window closed and cleared its marker, but the
  // process waiting for it was killed before it could read the result.
  for (const id of openSessions()) markClosed(id);
  for (const id of uncollectedResults()) dropResult(id);
  const orphan = newSessionId();
  writeResult(orphan, { cancelled: false, feedback: "feedback nobody collected" });

  assert.equal(lastSession(), orphan);
  const { stdout } = await run(process.execPath, [cli, "wait", "--last"]);

  assert.match(stdout, /feedback nobody collected/);
  assert.equal(readResult(orphan), null);
});

test("an uncollected result outranks a window that is still open", async () => {
  for (const id of openSessions()) markClosed(id);
  for (const id of uncollectedResults()) dropResult(id);
  const openOne = newSessionId();
  markOpen(openOne, "still-reading.md");
  const finished = newSessionId();
  writeResult(finished, { cancelled: false, feedback: "already submitted" });

  assert.equal(lastSession(), finished);

  dropResult(finished);
  markClosed(openOne);
});

test("collecting a result clears the open marker", async () => {
  const id = newSessionId();
  markOpen(id, "doc.md");
  writeResult(id, { cancelled: true, feedback: "closed" });

  await run(process.execPath, [cli, "wait", id]);

  assert.ok(!openSessions().includes(id));
});

test("wait prints the feedback the window process left behind", async () => {
  const id = newSessionId();
  writeResult(id, { cancelled: false, feedback: "## Change these\n\n1. notes/spec.md:3" });

  const { stdout } = await run(process.execPath, [cli, "wait", id, "--seconds", "1"]);

  assert.match(stdout, /## Change these/);
  assert.equal(readResult(id), null, "a collected result is removed");
});

test("show reports a missing file on stdout with a non-zero exit", async () => {
  await assert.rejects(
    run(process.execPath, [cli, "show", "no-such-file.md"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /could not show the document: cannot read no-such-file\.md \(ENOENT\)/);
      return true;
    },
  );
});

test("--simulate composes feedback without opening a window", async () => {
  const submission = join(appDir, "test", "fixtures", "submission.json");
  const { stdout } = await run(process.execPath, [cli, "show", sample, "--simulate", submission]);

  assert.match(stdout, /## Change these/);
  assert.match(stdout, /sample\.md:3-4/);
  assert.match(stdout, /## Answer these/);
});

test("several files land in one submission, each comment naming its own file", async () => {
  const submission = join(appDir, "test", "fixtures", "submission-two-files.json");
  const { stdout } = await run(process.execPath, [cli, "show", sample, plan, "--simulate", submission]);

  assert.match(stdout, /reviewed 2 documents \(.*sample\.md, .*plan\.md\)/);
  assert.match(stdout, /1\. .*sample\.md:3-4/);
  assert.match(stdout, /2\. .*plan\.md:3/);
  assert.match(stdout, /## Answer these[^]*3\. .*plan\.md:5/);
});

test("one unreadable file fails the whole call, so no partial set is shown", async () => {
  await assert.rejects(
    run(process.execPath, [cli, "show", sample, "no-such-file.md"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /cannot read no-such-file\.md \(ENOENT\)/);
      return true;
    },
  );
});

test("--print-html on two files renders both documents into one page", async () => {
  const { stdout } = await run(process.execPath, [cli, "show", sample, plan, "--print-html"], {
    maxBuffer: 4 * 1024 * 1024,
  });

  assert.match(stdout, /"documents":\[/);
  assert.match(stdout, /sample\.md/);
  assert.match(stdout, /plan\.md/);
  assert.match(stdout, /<title>Review — 2 files<\/title>/);
});
