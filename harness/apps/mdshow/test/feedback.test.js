import assert from "node:assert/strict";
import { test } from "node:test";

import { composeFeedback, EMPTY_FEEDBACK_PREFIX } from "../src/feedback.js";

const spec = {
  id: "d0",
  path: "notes/spec.md",
  blocks: [
    { id: "b0", startLine: 1, endLine: 1, text: "# Spec" },
    { id: "b1", startLine: 3, endLine: 5, text: "The service retries twice.\nThen it gives up.\nNo backoff." },
  ],
};

const plan = {
  id: "d1",
  path: "notes/plan.md",
  blocks: [{ id: "b0", startLine: 2, endLine: 2, text: "Ship the retry change first." }],
};

const bundle = { documents: [spec] };
const twoFiles = { documents: [spec, plan] };

test("no comments and no overall note reads as approval", () => {
  const feedback = composeFeedback(bundle, { overall: "  ", comments: [] });

  assert.ok(feedback.startsWith(EMPTY_FEEDBACK_PREFIX));
  assert.ok(feedback.includes("notes/spec.md"));
});

test("fix and discuss comments land in separate sections with line ranges", () => {
  const feedback = composeFeedback(bundle, {
    overall: "Close, two problems.",
    comments: [
      { docId: "d0", blockId: "b1", kind: "fix", body: "Add exponential backoff." },
      { docId: "d0", blockId: "b0", kind: "discuss", body: "Why is this a spec and not an ADR?" },
    ],
  });

  assert.match(feedback, /## Overall\n\nClose, two problems\./);
  assert.match(feedback, /## Change these\n\n1\. notes\/spec\.md:3-5/);
  assert.match(feedback, /> The service retries twice\./);
  assert.match(feedback, /Add exponential backoff\./);
  assert.match(feedback, /## Answer these \(do not edit just to satisfy them\)\n\n2\. notes\/spec\.md:1/);
  assert.ok(!feedback.includes(":1-1"), "a single-line block must not print a range");
});

test("empty comment bodies are dropped", () => {
  const feedback = composeFeedback(bundle, {
    comments: [
      { docId: "d0", blockId: "b1", kind: "fix", body: "   " },
      { docId: "d0", blockId: "b1", kind: "fix", body: "Real one." },
    ],
  });

  assert.equal(feedback.match(/^1\./gm).length, 1);
  assert.ok(!feedback.includes("2."));
});

test("multi-line comment bodies stay indented under their number", () => {
  const feedback = composeFeedback(bundle, {
    comments: [{ docId: "d0", blockId: "b1", kind: "fix", body: "line one\nline two" }],
  });

  assert.ok(feedback.includes("   line one\n   line two"));
});

test("a comment on an unknown block still names the file", () => {
  const feedback = composeFeedback(bundle, {
    comments: [{ docId: "d0", blockId: "gone", kind: "fix", body: "Stale anchor." }],
  });

  assert.match(feedback, /1\. notes\/spec\.md\n\s+Stale anchor\./);
});

test("a comment with no docId belongs to the first document", () => {
  const feedback = composeFeedback(bundle, {
    comments: [{ blockId: "b1", kind: "fix", body: "From a hand-written fixture." }],
  });

  assert.match(feedback, /1\. notes\/spec\.md:3-5/);
});

test("comments on two files keep one numbering and each name their own file", () => {
  const feedback = composeFeedback(twoFiles, {
    comments: [
      { docId: "d1", blockId: "b0", kind: "fix", body: "Do the retry change second." },
      { docId: "d0", blockId: "b1", kind: "fix", body: "Add exponential backoff." },
      { docId: "d1", blockId: "b0", kind: "discuss", body: "Is one week enough?" },
    ],
  });

  assert.match(feedback, /reviewed 2 documents \(notes\/spec\.md, notes\/plan\.md\)/);
  assert.match(feedback, /## Change these\n\n1\. notes\/plan\.md:2/);
  assert.match(feedback, /> Ship the retry change first\./);
  assert.match(feedback, /2\. notes\/spec\.md:3-5/);
  assert.match(feedback, /## Answer these \(do not edit just to satisfy them\)\n\n3\. notes\/plan\.md:2/);
});

test("the same block id in two files does not collide", () => {
  const feedback = composeFeedback(twoFiles, {
    comments: [
      { docId: "d0", blockId: "b0", kind: "fix", body: "Rename the title." },
      { docId: "d1", blockId: "b0", kind: "fix", body: "Reorder the steps." },
    ],
  });

  assert.match(feedback, /1\. notes\/spec\.md:1\n\s+> Spec\n\s+Rename the title\./);
  assert.match(feedback, /2\. notes\/plan\.md:2\n\s+> Ship the retry change first\.\n\s+Reorder the steps\./);
});

test("two files with no comments read as approval of both", () => {
  const feedback = composeFeedback(twoFiles, { comments: [] });

  assert.match(feedback, /read all 2 documents and approved them with no comments/);
  assert.match(feedback, /Nothing to change in notes\/spec\.md, notes\/plan\.md\./);
});

test("no reviewed marks means no reviewed section", () => {
  const feedback = composeFeedback(twoFiles, {
    comments: [{ docId: "d0", blockId: "b1", kind: "fix", body: "Add backoff." }],
  });

  assert.ok(!feedback.includes("Marked reviewed"));
});

test("a reviewed mark is reported, and an unmarked file is called unfinished", () => {
  const feedback = composeFeedback(twoFiles, {
    reviewed: ["d0"],
    comments: [{ docId: "d0", blockId: "b1", kind: "fix", body: "Add backoff." }],
  });

  assert.match(feedback, /## Marked reviewed\n\nDone with: notes\/spec\.md\./);
  assert.match(feedback, /Not marked reviewed: notes\/plan\.md\. Treat that file as unfinished, not approved\./);
});

test("a file marked reviewed still carries its comments", () => {
  const feedback = composeFeedback(twoFiles, {
    reviewed: ["d0", "d1"],
    comments: [{ docId: "d0", blockId: "b1", kind: "fix", body: "Add backoff." }],
  });

  assert.match(feedback, /Done with: notes\/spec\.md, notes\/plan\.md\./);
  assert.ok(!feedback.includes("Not marked reviewed"));
  assert.match(feedback, /## Change these\n\n1\. notes\/spec\.md:3-5/);
});

test("marking only one file reviewed with no comments does not approve the other", () => {
  const feedback = composeFeedback(twoFiles, { reviewed: ["d0"], comments: [] });

  assert.match(feedback, /marked notes\/spec\.md reviewed with no comments/);
  assert.match(feedback, /did not mark notes\/plan\.md reviewed — do not treat it as approved/);
});

test("marking every file reviewed with no comments reads as approval", () => {
  const feedback = composeFeedback(twoFiles, { reviewed: ["d0", "d1"], comments: [] });

  assert.match(feedback, /read all 2 documents and approved them with no comments/);
});

test("one file marked reviewed with no comments reads as approval", () => {
  const feedback = composeFeedback(bundle, { reviewed: ["d0"], comments: [] });

  assert.ok(feedback.startsWith(EMPTY_FEEDBACK_PREFIX));
});
