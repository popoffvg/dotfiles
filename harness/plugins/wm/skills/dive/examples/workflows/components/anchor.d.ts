import type { Comment, Range } from "../_flow.entities";

/** Line anchoring — hashing, position arithmetic, shifting and reconciling.
 *  @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:1 */
export declare class Anchor {
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:8 */
  static lineHash(line: string): string;
  static lineAt(text: string, line: number): string;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:45 */
  static applyChange(text: string, range: Range | null, newText: string): string;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:64 */
  static shiftForChange(comments: Comment[], range: Range, newText: string): number[];
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:118 */
  static rehash(text: string, comments: Comment[], touched: number[]): void;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:151 */
  static nearestHashMatch(text: string, hash: string, near: number): number | null;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/store.rs:50 */
  static cover(comment: Comment, line: number, endLine: number): void;
}
