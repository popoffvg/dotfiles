import assert from "node:assert/strict";
import { test } from "node:test";

import { splitBlocks, blockLabel } from "../src/blocks.js";

test("each heading, paragraph and list becomes one block with 1-based lines", () => {
  const source = ["# Title", "", "First para line one", "para line two", "", "- a", "- b", ""].join("\n");
  const blocks = splitBlocks(source);

  assert.deepEqual(
    blocks.map((block) => [block.startLine, block.endLine, block.text.split("\n")[0]]),
    [
      [1, 1, "# Title"],
      [3, 4, "First para line one"],
      [6, 7, "- a"],
    ],
  );
});

test("a fenced code block stays one block even with blank lines inside", () => {
  const source = ["intro", "", "```js", "const a = 1;", "", "const b = 2;", "```", "", "outro"].join("\n");
  const blocks = splitBlocks(source);

  assert.equal(blocks.length, 3);
  assert.deepEqual([blocks[1].startLine, blocks[1].endLine], [3, 7]);
  assert.ok(blocks[1].text.includes("const b = 2;"));
});

test("a heading directly after a paragraph starts its own block", () => {
  const blocks = splitBlocks(["text", "## Next", "more"].join("\n"));

  assert.deepEqual(
    blocks.map((block) => [block.startLine, block.text]),
    [
      [1, "text"],
      [2, "## Next"],
      [3, "more"],
    ],
  );
});

test("blockLabel strips heading marks and truncates", () => {
  assert.equal(blockLabel({ text: "### Some heading" }), "Some heading");
  assert.equal(blockLabel({ text: "x".repeat(200) }, 10).length, 10);
  assert.equal(blockLabel({ text: "```js\nconst a = 1;\n```" }), "const a = 1;");
});

test("carriage returns do not shift line numbers", () => {
  const blocks = splitBlocks("a\r\n\r\nb\r\n");

  assert.deepEqual(
    blocks.map((block) => [block.startLine, block.text]),
    [
      [1, "a"],
      [3, "b"],
    ],
  );
});
