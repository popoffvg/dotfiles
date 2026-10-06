import type { Comment, StoreKey } from "../_flow.entities";

/** Server state — open documents and the comment store, keyed by repo-relative path.
 *  @source harness/apps/line-comment/server/src/lib.rs:484 */
export declare class Session {
  /** @source harness/apps/line-comment/server/src/lib.rs:484 */
  static key(uri: string): StoreKey | null;
  /** @source harness/apps/line-comment/server/src/store.rs:110 */
  static comments(key: StoreKey): Comment[];
  static snapshot(key: StoreKey): Comment[];
  static documentText(uri: string): string;
  static putDocument(uri: string, text: string): void;
  static sortByLine(key: StoreKey): void;
}
