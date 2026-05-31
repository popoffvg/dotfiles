import type { RevealRequest, Target, Ulid } from "../_flow.entities";

/** The flow-reveal resolver — maps a binding on a line to its real source.
 *  @source /Users/popoffvg/Documents/git/dotfiles/harness/claude/scripts/flow-reveal.mjs:1 */
export declare class Resolver {
  /** Read the line, find a ULID or @source, resolve to a target.
   *  @source /Users/popoffvg/Documents/git/dotfiles/harness/claude/scripts/flow-reveal.mjs:108 */
  static resolveAtLine(req: RevealRequest): Target | null;
  /** Look a ULID up in the sibling *.bindings.json files.
   *  @source /Users/popoffvg/Documents/git/dotfiles/harness/claude/scripts/flow-reveal.mjs:57 */
  static lookupUlid(file: string, ulid: Ulid): Target | null;
  /** Pick the base (absolute / worktree root / git root) and join the source.
   *  @source /Users/popoffvg/Documents/git/dotfiles/harness/claude/scripts/flow-reveal.mjs:95 */
  static resolveTarget(source: string): Target;
}
