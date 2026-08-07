/**
 * Build the self-contained page shown in the native window.
 *
 * Everything is inlined — no CDN, no local server — because the window has to
 * work offline and outlive nothing but the CLI process that opened it.
 *
 * One window shows a bundle of one or more documents. The reader switches files
 * inside the window and sends one round of feedback for all of them, so the
 * agent gets a single answer per turn instead of one window per file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { splitBlocks } from "./blocks.js";
import { renderBlock, escapeHtml } from "./render.js";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..", "web");

/** Keep the payload from ending the inline <script> that carries it. */
function encodePayload(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp("\\u2028", "g"), "\\u2028")
    .replace(new RegExp("\\u2029", "g"), "\\u2029");
}

export function buildDocument(source, path, id = "d0") {
  const blocks = splitBlocks(source).map((block) => ({ ...block, html: renderBlock(block.text) }));
  return { id, path, blocks };
}

/** @param {Array<{id: string, path: string, blocks: Array}>} documents */
export function buildBundle(documents) {
  return { documents };
}

/** The document ids are positional, so a bundle can be rebuilt the same way twice. */
export function documentId(index) {
  return `d${index}`;
}

/** Every path in the bundle, for a window title, a log line, or a notice. */
export function bundlePaths(bundle) {
  return bundle.documents.map((document) => document.path).join(", ");
}

export function buildPage(bundle, title) {
  const template = readFileSync(join(webDir, "page.html"), "utf8");
  const style = readFileSync(join(webDir, "style.css"), "utf8");
  const app = readFileSync(join(webDir, "app.js"), "utf8");

  return template
    .replace("__TITLE__", escapeHtml(title))
    .replace("__STYLE__", () => style)
    .replace("__PAYLOAD__", () => encodePayload(bundle))
    .replace("__APP__", () => app);
}
