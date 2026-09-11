export interface TreeGroup {
  /** Directory the files sit in, `""` for a file at the repository root. */
  readonly dir: string;
  readonly paths: readonly string[];
}

/**
 * Group paths under their directory, keeping the ranking: a directory takes the position of
 * its best-ranked file, and the files inside it stay in the order they arrived.
 *
 * The ranking is the whole point of the pane, so grouping may not sort. A directory that
 * reappears further down the ranking joins the group it already has rather than opening a
 * second one — one heading per directory keeps the tree readable in a 36-column pane.
 */
export function groupByDirectory(paths: readonly string[]): TreeGroup[] {
  const order: string[] = [];
  const byDir = new Map<string, string[]>();

  for (const path of paths) {
    const cut = path.lastIndexOf("/");
    const dir = cut < 0 ? "" : path.slice(0, cut);
    const existing = byDir.get(dir);
    if (existing) existing.push(path);
    else {
      byDir.set(dir, [path]);
      order.push(dir);
    }
  }

  return order.map((dir) => ({ dir, paths: byDir.get(dir) ?? [] }));
}

/** `├──` for every file but the last of its group, `└──` for the last. */
export function branchGlyph(index: number, total: number): string {
  return index === total - 1 ? "└──" : "├──";
}

/** The part of a path the group heading does not already show. */
export function leafName(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? path : path.slice(cut + 1);
}
