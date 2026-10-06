// Shared types + components live one level up, at $WORKFLOWS_DIR/.
import type { Change, Comment, Effect, StoreKey } from "../_flow.entities";
import { Anchor } from "../components/anchor";
import { Session } from "../components/session";

export const meta = {
  name: "anchor-reconcile",
  description: "How a stored line comment finds its line again after the file changes.",
};

export function flow(uri: string, changes: Change[]): Effect[] {
  const key: StoreKey | null = Session.key(uri);
  if (!key) {                                     // 01M22XEKBDETWCF2DCC4HZP9F9
    return [];
  }

  const before: Comment[] = Session.snapshot(key);
  let text = Session.documentText(uri);

  for (const change of changes) {
    if (change.range) {                           // 01M22XEKD6VAT48G3SM0V111NW
      const touched = Anchor.shiftForChange(Session.comments(key), change.range, change.text);
      text = Anchor.applyChange(text, change.range, change.text);
      Anchor.rehash(text, Session.comments(key), touched);
    } else {
      text = Anchor.applyChange(text, null, change.text);
      reanchorByHash(text, Session.comments(key));
    }
    Session.sortByLine(key);
  }

  Session.putDocument(uri, text);
  if (Session.snapshot(key) === before) {         // 01M22XEKD696A3NH3EG8N3GEDQ
    return [];
  }
  return ["PersistStore", "PublishDiagnostics"];
}

function reanchorByHash(text: string, comments: Comment[]): void {
  for (const comment of comments) {
    if (Anchor.lineHash(Anchor.lineAt(text, comment.line)) === comment.hash) {  // 01M22XEKD6NTM56YB9WC785Y6S
      comment.orphaned = false;
      continue;
    }
    const nearest = Anchor.nearestHashMatch(text, comment.hash, comment.line);
    if (nearest === null) {                       // 01M22XEKD6AJR0CE5EZ7VWTSTG
      comment.orphaned = true;
      continue;
    }
    Anchor.cover(comment, nearest, nearest + (comment.lastLine - comment.line));
    comment.orphaned = false;
  }
}
