import assert from "node:assert/strict";
import { test } from "node:test";

import { renderBlock, renderInline, escapeHtml } from "../src/render.js";
import { buildBundle, buildDocument, buildPage, bundlePaths, documentId } from "../src/page.js";

test("html in the source is escaped, never executed", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.ok(!renderBlock("<script>alert(1)</script>").includes("<script>"));
});

test("headings, code fences, quotes, lists and tables render", () => {
  assert.equal(renderBlock("## Two"), "<h2>Two</h2>");
  assert.equal(renderBlock("```js\nconst a = 1;\n```"), '<pre><span class="lang">js</span><code>const a = 1;</code></pre>');
  assert.equal(renderBlock("> quoted"), "<blockquote><p>quoted</p></blockquote>");
  assert.equal(renderBlock("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(renderBlock("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
  assert.equal(renderBlock("---"), "<hr>");
  assert.match(renderBlock("| a | b |\n| --- | --- |\n| 1 | 2 |"), /<table><thead><tr><th>a<\/th><th>b<\/th>/);
});

test("inline emphasis, code and links render; code content is not re-parsed", () => {
  assert.equal(renderInline("**bold** and *thin*"), "<strong>bold</strong> and <em>thin</em>");
  assert.equal(renderInline("`a *b* c`"), "<code>a *b* c</code>");
  assert.equal(renderInline("[docs](https://example.com)"), '<a href="https://example.com">docs</a>');
  assert.equal(renderInline("~~gone~~"), "<del>gone</del>");
});

test("an underscore inside a word does not become emphasis", () => {
  assert.equal(renderInline("some_long_name here"), "some_long_name here");
});

function payloadOf(page) {
  const encoded = page.match(/window\.__MDSHOW__ = (\{.*\});/)[1];
  return JSON.parse(encoded.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&"));
}

test("the page inlines the payload, the style and the app, with no external request", () => {
  const bundle = buildBundle([buildDocument("# Title\n\ntext with </script> inside\n", "notes/spec.md")]);
  const page = buildPage(bundle, "Review — spec.md");

  assert.ok(page.includes("window.__MDSHOW__ = {"));
  assert.ok(!page.includes("__PAYLOAD__") && !page.includes("__APP__") && !page.includes("__STYLE__"));
  assert.ok(!page.includes("</script> inside"), "payload must not close the script tag");
  assert.ok(page.includes("glimpse.send"));
  assert.ok(!/src\s*=\s*"http/.test(page) && !/href\s*=\s*"http/.test(page), "no CDN reference");
  assert.equal(payloadOf(page).documents[0].blocks.length, 2);
});

test("a bundle carries every document, each with its own id and path", () => {
  const bundle = buildBundle([
    buildDocument("# Spec\n", "notes/spec.md", documentId(0)),
    buildDocument("# Plan\n\nstep one\n", "notes/plan.md", documentId(1)),
  ]);

  assert.equal(bundlePaths(bundle), "notes/spec.md, notes/plan.md");

  const payload = payloadOf(buildPage(bundle, "Review — 2 files"));
  assert.deepEqual(
    payload.documents.map((document) => [document.id, document.path, document.blocks.length]),
    [
      ["d0", "notes/spec.md", 1],
      ["d1", "notes/plan.md", 2],
    ],
  );
});
