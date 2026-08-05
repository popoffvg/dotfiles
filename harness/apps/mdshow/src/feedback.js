/**
 * Compose the text the agent receives after the reader submits the window.
 *
 * Two comment kinds carry different obligations, so they are kept apart:
 *   fix     — change the document or the code.
 *   discuss — answer or justify; do not edit only to silence the comment.
 *
 * A submission can cover several documents. Each comment names its own file, so
 * one numbered list can point at two files without the agent losing track of
 * which line belongs to which.
 *
 * The reader can also tick a file as reviewed. That is a claim about their own
 * reading, not about the file being comment-free: a ticked file with comments is
 * finished, and an unticked file with no comments is not approved.
 */

import { blockLabel } from "./blocks.js";
import { bundlePaths } from "./page.js";

export const CANCELLED_FEEDBACK =
  "The reader closed the review window without sending feedback. Do not guess what they wanted — stop and wait for their next instruction.";

export const EMPTY_FEEDBACK_PREFIX = "The reader read the document and approved it with no comments.";

/** Where a comment points, resolved against the document it was written on. */
function locate(comment, index) {
  const target = index.byId.get(comment.docId ?? index.defaultDocId);
  if (target == null) return { path: "the document", block: null };
  const block = target.blocksById.get(comment.blockId);
  if (block == null) return { path: target.path, block: null };
  const range =
    block.endLine !== block.startLine ? `${block.startLine}-${block.endLine}` : `${block.startLine}`;
  return { path: `${target.path}:${range}`, block };
}

function renderComment(comment, index, order) {
  const { path, block } = locate(comment, index);
  const lines = [`${order}. ${path}`];
  if (block != null) lines.push(`   > ${blockLabel(block)}`);
  const body = comment.body.trim();
  for (const line of body.split("\n")) lines.push(`   ${line}`);
  return lines.join("\n");
}

/** docId → {path, blocksById}, plus the id a comment with no docId belongs to. */
function indexDocuments(documents) {
  return {
    byId: new Map(
      documents.map((document) => [
        document.id,
        { path: document.path, blocksById: new Map(document.blocks.map((block) => [block.id, block])) },
      ]),
    ),
    // A hand-written --simulate fixture carries no docId. The first document is
    // the only sane target, and with one document there is no ambiguity at all.
    defaultDocId: documents[0]?.id,
  };
}

/**
 * @param {{documents: Array<{id: string, path: string, blocks: Array}>}} bundle
 * @param {{overall?: string, reviewed?: string[], comments?: Array<{docId?: string, blockId: string, kind: "fix"|"discuss", body: string}>}} submission
 * @returns {string} markdown handed to the agent
 */
export function composeFeedback(bundle, submission) {
  const index = indexDocuments(bundle.documents);
  const paths = bundlePaths(bundle);
  const comments = (submission.comments ?? []).filter((comment) => comment.body.trim() !== "");
  const overall = (submission.overall ?? "").trim();

  const count = bundle.documents.length;

  // A file the reader ticked off is one they say they are done with. A file they
  // left unticked is not approved, even when it carries no comment.
  const reviewedIds = new Set(submission.reviewed ?? []);
  const marked = bundle.documents.filter((document) => reviewedIds.has(document.id));
  const unmarked = bundle.documents.filter((document) => !reviewedIds.has(document.id));
  const list = (documents) => documents.map((document) => document.path).join(", ");

  if (comments.length === 0 && overall === "") {
    if (marked.length > 0 && unmarked.length > 0) {
      return [
        `The reader marked ${list(marked)} reviewed with no comments, so nothing changes there.`,
        `They did not mark ${list(unmarked)} reviewed — do not treat ${
          unmarked.length === 1 ? "it" : "them"
        } as approved. Ask whether they still want to read ${unmarked.length === 1 ? "it" : "them"}.`,
      ].join("\n");
    }
    const read =
      count === 1
        ? EMPTY_FEEDBACK_PREFIX
        : `The reader read all ${count} documents and approved them with no comments.`;
    return `${read} Nothing to change in ${paths}.`;
  }

  const subject = count === 1 ? paths : `${count} documents (${paths})`;
  const out = [`The reader reviewed ${subject} in the review window and left this feedback.`, ""];

  if (overall !== "") {
    out.push("## Overall", "", overall, "");
  }

  if (marked.length > 0) {
    out.push("## Marked reviewed", "", `Done with: ${list(marked)}.`);
    if (unmarked.length > 0) {
      out.push(
        `Not marked reviewed: ${list(unmarked)}. Treat ${
          unmarked.length === 1 ? "that file" : "those files"
        } as unfinished, not approved.`,
      );
    }
    out.push("");
  }

  const fixes = comments.filter((comment) => comment.kind !== "discuss");
  const questions = comments.filter((comment) => comment.kind === "discuss");
  let order = 1;

  if (fixes.length > 0) {
    out.push("## Change these", "");
    for (const comment of fixes) out.push(renderComment(comment, index, order++), "");
  }

  if (questions.length > 0) {
    out.push("## Answer these (do not edit just to satisfy them)", "");
    for (const comment of questions) out.push(renderComment(comment, index, order++), "");
  }

  return out.join("\n").trimEnd();
}
