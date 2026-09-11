import { createHash } from "node:crypto";
import { useMemo, useSyncExternalStore } from "react";
import type {
  ExtensionDiffFile,
  ExtensionPaneProps,
  ExtensionPaneTheme,
  ExtensionReviewNote,
  ExtensionReviewSnapshotNote,
  HunkExtensionAPI,
} from "hunkdiff/extension";
import { quoteReason } from "./quote";
import { branchGlyph, groupByDirectory, leafName } from "./tree";
import {
  agentCommand,
  agentModel,
  askAgent,
  buildPrompt,
  changedFiles,
  headCommit,
  parseSuggestions,
  spawnFailure,
  type ChangedFile,
} from "./generate";
import {
  DEFAULT_GENERATED_PATTERNS,
  DEFAULT_TEST_PATTERNS,
  orderPaths,
  tierOf,
  type Tier,
  type TierRules,
} from "./classify";
import {
  findRepoRoot,
  readComments,
  readMarks,
  readRanking,
  readReviewed,
  reviewKey,
  toRepoPath,
  writeComment,
  writeMarks,
  writeRanking,
  writeReviewedFile,
  type FocusMark,
  type ReviewedFileState,
  type SavedComment,
} from "./store";

interface ReviewedProgress {
  readonly patchHash: string;
  readonly reviewedHunks: ReadonlySet<number>;
  readonly totalHunks: number;
  readonly fileReviewed: boolean;
}

interface FocusSnapshot {
  readonly repoRoot: string;
  readonly tiers: Readonly<Record<string, Tier>>;
  readonly reasons: Readonly<Record<string, string>>;
  readonly counts: Readonly<Record<Tier, number>>;
  readonly reviewed: Readonly<Record<string, ReviewedProgress>>;
  readonly reviewedFileCount: number;
  readonly reviewedHunkCount: number;
  readonly totalHunkCount: number;
}

const EMPTY_SNAPSHOT: FocusSnapshot = {
  repoRoot: "",
  tiers: {},
  reasons: {},
  counts: { focused: 0, normal: 0, test: 0, generated: 0 },
  reviewed: {},
  reviewedFileCount: 0,
  reviewedHunkCount: 0,
  totalHunkCount: 0,
};

function patchHashOf(file: ExtensionDiffFile): string {
  return createHash("sha1").update(file.patch).digest("hex");
}

function applyReviewedUpdate(repoRoot: string, filePath: string, next: ReviewedProgress): void {
  const previous = snapshot.reviewed[filePath];
  const previousContribution = previous ? (previous.fileReviewed ? previous.totalHunks : previous.reviewedHunks.size) : 0;
  const nextContribution = next.fileReviewed ? next.totalHunks : next.reviewedHunks.size;
  const fileCountDelta = (next.fileReviewed ? 1 : 0) - (previous?.fileReviewed ? 1 : 0);

  // Unmarking the last hunk removes the entry rather than storing an empty one: Start here
  // lists a file with *any* progress, so an empty entry would keep an untouched file listed.
  const emptied = !next.fileReviewed && next.reviewedHunks.size === 0;
  const reviewed = { ...snapshot.reviewed };
  if (emptied) delete reviewed[filePath];
  else reviewed[filePath] = next;

  publish({
    ...snapshot,
    reviewed,
    reviewedHunkCount: snapshot.reviewedHunkCount - previousContribution + nextContribution,
    reviewedFileCount: snapshot.reviewedFileCount + fileCountDelta,
  });

  writeReviewedFile(
    repoRoot,
    filePath,
    emptied ? null : { patchHash: next.patchHash, hunks: [...next.reviewedHunks], fileReviewed: next.fileReviewed },
  );
}

let snapshot: FocusSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

function publish(next: FocusSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readSnapshot(): FocusSnapshot {
  return snapshot;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

interface PaneRow {
  readonly key: string;
  readonly content: string;
  readonly fg: string;
  readonly bg?: string;
  readonly onMouseDown?: () => void;
}

function progressMark(progress: ReviewedProgress | undefined): string {
  if (progress?.fileReviewed) return "✓";
  return progress && progress.reviewedHunks.size > 0 ? "·" : " ";
}

function fitPath(path: string, width: number): string {
  return path.length <= width ? path : `…${path.slice(path.length - width + 1)}`;
}

function startHereRows(
  files: readonly ExtensionDiffFile[],
  focus: FocusSnapshot,
  selectedFileId: string | null,
  theme: ExtensionPaneTheme,
  width: number,
  selectFile: (fileId: string) => void,
): PaneRow[] {
  const rows: PaneRow[] = [{ key: "title", content: " Start here", fg: theme.accent }];
  if (focus.totalHunkCount > 0) {
    rows.push({
      key: "progress",
      content: ` ${focus.reviewedFileCount} file(s), ${focus.reviewedHunkCount}/${focus.totalHunkCount} hunks reviewed`,
      fg: theme.muted,
    });
  }

  // Marked (★) files, plus any file with review progress even if never marked — reviewed
  // state must stay visible here, not just for the files you also flagged important.
  const listed = files.filter(
    (file) => focus.tiers[file.path] === "focused" || focus.reviewed[file.path] !== undefined,
  );
  // The placeholder says what is missing and how to get it. "Nothing here" alone reads the
  // same whether the ranking has not run, failed, or genuinely had nothing to say.
  if (listed.length === 0) {
    rows.push({ key: "empty", content: " no ranking for this diff", fg: theme.muted });
    rows.push({ key: "empty:how", content: " run `hunk focus generate`", fg: theme.accentMuted });
    rows.push({ key: "empty:keys", content: " ctrl+b for the plain file list", fg: theme.muted });
  }

  // Drawn as a tree, one heading per directory: the paths of a ranking repeat their leading
  // directories, and repeating them costs the columns a 36-wide pane does not have.
  const byPath = new Map(listed.map((file) => [file.path, file]));
  for (const group of groupByDirectory(listed.map((file) => file.path))) {
    if (group.dir.length > 0) {
      rows.push({
        key: `dir:${group.dir}`,
        content: ` ${fitPath(group.dir, Math.max(4, width - 3))}/`,
        fg: theme.muted,
      });
    }

    group.paths.forEach((path, index) => {
      const file = byPath.get(path);
      if (!file) return;
      const selected = file.id === selectedFileId;
      const marked = focus.tiers[path] === "focused";
      const glyph = group.dir.length > 0 ? ` ${branchGlyph(index, group.paths.length)} ` : " ";
      const name = group.dir.length > 0 ? leafName(path) : path;

      rows.push({
        key: `${file.id}:path`,
        content: `${glyph}${progressMark(focus.reviewed[path])}${marked ? "★" : " "} ${fitPath(name, Math.max(4, width - glyph.length - 3))}`,
        fg: selected ? theme.accent : theme.text,
        bg: selected ? theme.selectedHunk : theme.panel,
        onMouseDown: () => selectFile(file.id),
      });

      // A file's stats and reason hang under its own branch, so the trunk stays readable
      // while a group is still open below it.
      const trunk = group.dir.length > 0 && index < group.paths.length - 1 ? " │  " : "    ";
      rows.push({
        key: `${file.id}:stats`,
        content: `${trunk} +${file.stats.additions} -${file.stats.deletions}`,
        fg: theme.muted,
      });

      const reason = focus.reasons[path];
      if (!reason) return;
      const quoted = quoteReason(reason, Math.max(8, width - 8));
      if (quoted.header) rows.push({ key: `${file.id}:why`, content: `${trunk} ${quoted.header}`, fg: theme.muted });
      quoted.body.forEach((line, lineIndex) => {
        rows.push({ key: `${file.id}:quote:${lineIndex}`, content: `${trunk} > ${line}`, fg: theme.noteBorder });
      });
    });
  }

  const demoted = focus.counts.test + focus.counts.generated;
  if (demoted > 0) {
    rows.push({
      key: "demoted",
      content: ` moved down: ${focus.counts.test} test, ${focus.counts.generated} generated`,
      fg: theme.muted,
    });
  }
  return rows;
}

function PaneRows({ rows, theme }: { rows: readonly PaneRow[]; theme: ExtensionPaneTheme }) {
  return (
    <box style={{ width: "100%", flexDirection: "column", backgroundColor: theme.panel }}>
      {rows.map((row) => (
        <text
          key={row.key}
          content={row.content}
          style={{ fg: row.fg, bg: row.bg ?? theme.panel }}
          {...(row.onMouseDown ? { onMouseDown: row.onMouseDown } : {})}
        />
      ))}
    </box>
  );
}

function scrollProps(theme: ExtensionPaneTheme) {
  return {
    focused: false,
    scrollY: true,
    rootOptions: { backgroundColor: theme.panel },
    wrapperOptions: { backgroundColor: theme.panel },
    viewportOptions: { backgroundColor: theme.panel },
    contentOptions: { backgroundColor: theme.panel },
    verticalScrollbarOptions: { visible: false },
    horizontalScrollbarOptions: { visible: false },
  };
}

// Start here is the left column a review opens on: Hunk's own file list is still registered
// and still reordered, it just starts closed (`replaces: "hunk:files"`).
function StartHerePane({ files, selectedFileId, theme, width, actions }: ExtensionPaneProps) {
  const focus = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);

  const rows = useMemo(
    () => startHereRows(files, focus, selectedFileId, theme, width, actions.selectFile),
    [files, focus, selectedFileId, theme, width, actions],
  );

  return (
    <scrollbox style={{ width: "100%", height: "100%" }} {...scrollProps(theme)}>
      <PaneRows rows={rows} theme={theme} />
    </scrollbox>
  );
}

const USAGE = [
  "Usage:",
  "  hunk focus generate [<revisions...>]        ask the agent what to read first",
  "    --skip                                    never ask; reuse a stored ranking or open empty",
  "    --force                                   ask again even when this commit is already ranked",
  "  hunk focus add <path...> [--why <reason>]   mark files worth reading first",
  "  hunk focus rm <path...>                     drop marks",
  "  hunk focus list [--json]                    show marks for this repo",
  "  hunk focus clear --yes                      drop every mark for this repo",
  "",
  "Marks are read when a review loads; run `hunk session reload --repo .` to apply",
  "them to a window that is already open.",
  "",
].join("\n");

/** Files the agent may name, and how long it gets to answer. */
const GENERATE_LIMIT = 8;
const GENERATE_TIMEOUT_MS = 240_000;

export default function (hunk: HunkExtensionAPI) {
  const configuredTests = stringList(hunk.config.testPatterns);
  const configuredGenerated = stringList(hunk.config.generatedPatterns);
  const demoteTests = boolOr(hunk.config.demoteTests, true);
  const demoteGenerated = boolOr(hunk.config.demoteGenerated, true);

  const rulesFor = (marks: readonly FocusMark[]): TierRules => ({
    focusedPaths: new Set(marks.map((mark) => mark.path)),
    testPatterns: [...DEFAULT_TEST_PATTERNS, ...configuredTests],
    generatedPatterns: [...DEFAULT_GENERATED_PATTERNS, ...configuredGenerated],
    demoteTests,
    demoteGenerated,
  });

  hunk.transformChangeset((changeset, ctx) => {
    const repoRoot = findRepoRoot(ctx.cwd);
    const marks = readMarks(repoRoot);
    const rules = rulesFor(marks);
    const storedReviewed = readReviewed(repoRoot);

    const tiers: Record<string, Tier> = {};
    const counts: Record<Tier, number> = { focused: 0, normal: 0, test: 0, generated: 0 };
    const reviewed: Record<string, ReviewedProgress> = {};
    let reviewedFileCount = 0;
    let reviewedHunkCount = 0;
    let totalHunkCount = 0;

    for (const file of changeset.files) {
      const tier = tierOf(file.path, rules);
      tiers[file.path] = tier;
      counts[tier] += 1;

      const totalHunks = file.hunks?.length ?? 0;
      totalHunkCount += totalHunks;
      const hash = patchHashOf(file);
      const stored = storedReviewed[file.path];
      // A stale patchHash means the diff moved under this file since it was marked — drop it
      // rather than show reviewed marks against hunks that may no longer be the ones reviewed.
      if (stored && stored.patchHash !== hash) writeReviewedFile(repoRoot, file.path, null);
      const live = stored && stored.patchHash === hash ? stored : null;

      if (live) {
        const reviewedHunks = new Set(live.hunks);
        reviewed[file.path] = { patchHash: hash, reviewedHunks, totalHunks, fileReviewed: live.fileReviewed };
        reviewedHunkCount += live.fileReviewed ? totalHunks : reviewedHunks.size;
        if (live.fileReviewed) reviewedFileCount += 1;
      }
    }

    const reasons: Record<string, string> = {};
    for (const mark of marks) if (mark.why) reasons[mark.path] = mark.why;

    publish({ repoRoot, tiers, reasons, counts, reviewed, reviewedFileCount, reviewedHunkCount, totalHunkCount });

    if (counts.focused === 0 && counts.test === 0 && counts.generated === 0) return changeset;
    return { ...changeset, files: orderPaths(changeset.files, (file) => file.path, rules) };
  });

  hunk.registerPane({
    id: "start-here",
    title: "Start here",
    placement: "left",
    // Opens in the files pane's place, which therefore starts closed: a review opens on the
    // ranked reading order, not on every changed path. Both panes stay toggleable —
    // `ctrl+f` for this one, `ctrl+b` for the file list it opened in front of.
    replaces: "hunk:files",
    width: { preferred: 36, min: 24, fraction: 0.22 },
    component: StartHerePane,
  });

  hunk.registerCommand({ id: "toggle", title: "Show/hide Start here", key: "ctrl+f" }, (ctx) => {
    ctx.panes.toggle("start-here");
  });

  // Hunk's own files-pane command resolves to whatever owns the files slot, which is this
  // extension's pane — so the built-in list needs a key that addresses it literally, or
  // replacing the slot would make it unreachable for the rest of the session.
  hunk.registerCommand({ id: "files", title: "Show/hide the file list", key: "ctrl+b" }, (ctx) => {
    ctx.panes.toggle("hunk:files");
  });

  hunk.registerCommand({ id: "first", title: "Jump to first marked file", key: "ctrl+g" }, (ctx) => {
    const marked = Object.entries(snapshot.tiers).find(([, tier]) => tier === "focused");
    if (!marked) {
      ctx.notify("review-focus: nothing marked for this diff", "warning");
      return;
    }
    ctx.navigation.selectFile(marked[0]);
  });

  hunk.registerCommand({ id: "mark", title: "Mark selected file to read first", key: "i" }, async (ctx) => {
    const file = ctx.selection.file;
    if (!file) {
      ctx.notify("review-focus: no file selected", "warning");
      return;
    }

    const repoRoot = findRepoRoot(ctx.cwd);
    const marks = readMarks(repoRoot);
    const already = marks.some((mark) => mark.path === file.path);

    if (already) {
      writeMarks(
        repoRoot,
        marks.filter((mark) => mark.path !== file.path),
      );
      ctx.notify(`review-focus: unmarked ${file.path}`);
    } else {
      const why = await ctx.dialogs.input({
        title: `Why does ${file.path} come first?`,
        placeholder: "optional — Enter to skip",
      });
      if (why === null) return;
      const at = new Date().toISOString();
      const trimmed = why.trim();
      writeMarks(repoRoot, [...marks, trimmed ? { path: file.path, why: trimmed, at } : { path: file.path, at }]);
      ctx.notify(`review-focus: marked ${file.path}`);
    }

    if (!ctx.commands.execute("hunk.app.refresh")) {
      ctx.notify("review-focus: press r to see the new order", "warning");
    }
  });

  hunk.registerCommand({ id: "markHunk", title: "Mark hunk reviewed, then advance", key: "m" }, (ctx) => {
    const file = ctx.selection.file;
    const hunkIndex = ctx.selection.hunkIndex;
    if (!file || hunkIndex === null) {
      ctx.notify("review-focus: no hunk selected", "warning");
      return;
    }

    const repoRoot = findRepoRoot(ctx.cwd);
    const hash = patchHashOf(file);
    const current = snapshot.reviewed[file.path];
    const totalHunks = file.hunks?.length ?? 0;
    const reviewedHunks = new Set(current && current.patchHash === hash ? current.reviewedHunks : []);
    reviewedHunks.add(hunkIndex);

    applyReviewedUpdate(repoRoot, file.path, {
      patchHash: hash,
      reviewedHunks,
      totalHunks,
      fileReviewed: reviewedHunks.size >= totalHunks,
    });

    ctx.commands.execute("hunk.review.nextHunk");
  });

  // The exact inverse of `m`. Because `m` advances after marking, the mark to undo is the one
  // *before* the cursor — so this steps back first and unmarks what it lands on, and pressing
  // m,m,m,M,M leaves hunk 1 marked with the cursor on hunk 2.
  hunk.registerCommand({ id: "unmarkHunk", title: "Step back and unmark that hunk", key: "M" }, (ctx) => {
    const file = ctx.selection.file;
    const hunkIndex = ctx.selection.hunkIndex;
    if (!file || hunkIndex === null) {
      ctx.notify("review-focus: no hunk selected", "warning");
      return;
    }

    // At the first hunk there is nothing to step back to, so `M` unmarks it in place.
    const target = Math.max(0, hunkIndex - 1);
    const hash = patchHashOf(file);
    const current = snapshot.reviewed[file.path];

    // The jump happens either way: it is half of what the key promises, and landing on the
    // hunk is what lets the reviewer see why nothing was unmarked.
    ctx.navigation.selectHunk(file.id, target);

    if (!current || current.patchHash !== hash || !current.reviewedHunks.has(target)) {
      ctx.notify(`review-focus: hunk ${target + 1} was not marked`, "warning");
      return;
    }

    const reviewedHunks = new Set(current.reviewedHunks);
    reviewedHunks.delete(target);
    applyReviewedUpdate(findRepoRoot(ctx.cwd), file.path, {
      patchHash: hash,
      reviewedHunks,
      totalHunks: file.hunks?.length ?? 0,
      fileReviewed: false,
    });
  });

  hunk.registerCommand({ id: "markFile", title: "Mark selected file fully reviewed", key: "space" }, (ctx) => {
    const file = ctx.selection.file;
    if (!file) {
      ctx.notify("review-focus: no file selected", "warning");
      return;
    }

    const repoRoot = findRepoRoot(ctx.cwd);
    const totalHunks = file.hunks?.length ?? 0;
    applyReviewedUpdate(repoRoot, file.path, {
      patchHash: patchHashOf(file),
      reviewedHunks: new Set(Array.from({ length: totalHunks }, (_, index) => index)),
      totalHunks,
      fileReviewed: true,
    });

    ctx.notify(`review-focus: ${file.path} marked reviewed`);
  });

  // A note lives in the session's memory and dies when Hunk exits, so every saved note is
  // mirrored to the comment store as it is written. prx reads that store back to restore the
  // notes into the next run and to offer posting them.
  const noteStoreIds = new Map<string, string>();

  const commentId = (comment: SavedComment): string =>
    [comment.filePath, comment.side, comment.line, comment.summary].join(" ");

  const rememberNote = (cwd: string, note: ExtensionReviewNote): void => {
    if (note.draft) return;
    const key = reviewKey(findRepoRoot(cwd));
    const comment: SavedComment = { filePath: note.filePath, side: note.side, line: note.line, summary: note.body };
    const id = commentId(comment);
    const previous = noteStoreIds.get(note.id);
    if (previous && previous !== id) writeComment(key, previous, null);
    noteStoreIds.set(note.id, id);
    writeComment(key, id, comment);
  };

  const bindRestoredNote = (cwd: string, note: ExtensionReviewSnapshotNote): void => {
    const key = reviewKey(findRepoRoot(cwd));
    const line = note.anchor.preferred?.line;
    const entry = Object.entries(readComments(key)).find(
      ([, comment]) => comment.summary === note.summary && comment.line === line,
    );
    if (entry) noteStoreIds.set(note.id, entry[0]);
  };

  hunk.on("note_created", ({ note }, ctx) => rememberNote(ctx.cwd, note));
  hunk.on("note_edited", ({ note }, ctx) => rememberNote(ctx.cwd, note));

  hunk.on("note_changed", ({ kind, note }, ctx) => {
    if (kind === "removed") {
      const id = noteStoreIds.get(note.id);
      if (!id) return;
      writeComment(reviewKey(findRepoRoot(ctx.cwd)), id, null);
      noteStoreIds.delete(note.id);
      return;
    }
    // A note prx restored arrives as an agent comment, which carries an opaque file key
    // instead of the path the store is keyed on. Bind it to the entry it was restored from,
    // so deleting it here deletes it there too.
    if (!noteStoreIds.has(note.id)) bindRestoredNote(ctx.cwd, note);
  });

  hunk.on("startup", (_event, ctx) => {
    const marks = readMarks(findRepoRoot(ctx.cwd));
    if (marks.length > 0) ctx.notify(`review-focus: ${marks.length} file(s) marked to read first`);
  });

  hunk.registerCliCommand(
    { name: "focus", summary: "Mark the files of a review worth reading first", usage: "<add|rm|list|clear> [args...]" },
    async (args, ctx) => {
      const repoRoot = findRepoRoot(ctx.cwd);
      const marks = readMarks(repoRoot);
      const [subcommand, ...rest] = args;

      if (!subcommand || subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
        await ctx.stdout.write(USAGE);
        return { kind: "exit", code: subcommand ? 0 : 2 };
      }

      // `generate` is the whole Start here list: the agent's answer replaces the marks rather
      // than merging into them, so the pane always shows one coherent reading order instead of
      // this run's ranking layered over a stale one.
      if (subcommand === "generate") {
        // Every exit from here reports why. An unreported one leaves the pane empty, which
        // reads on screen exactly like an agent that had nothing to say.
        let files: readonly ChangedFile[];
        try {
          files = changedFiles(repoRoot, rest.filter((token) => !token.startsWith("--")));
        } catch (error) {
          await ctx.stderr.write(`git diff failed — ${spawnFailure(error)}\n`);
          return { kind: "exit", code: 1 };
        }
        if (files.length === 0) {
          await ctx.stderr.write(`no changed files in ${repoRoot}\n`);
          return { kind: "exit", code: 1 };
        }

        // The ranking is read before the agent is ever considered: its file is named for this
        // review and this commit, so its existence is the whole answer to "was this ranked
        // already?" — no comparison, and one agent run per pull request per commit.
        const key = reviewKey(repoRoot);
        const head = headCommit(repoRoot);
        const stored = readRanking(key, head);

        if (stored !== null && !rest.includes("--force")) {
          writeMarks(repoRoot, stored.marks);
          for (const mark of stored.marks) {
            await ctx.stdout.write(mark.why ? `${mark.path}  — ${mark.why}\n` : `${mark.path}\n`);
          }
          await ctx.stdout.write(`stored ranking of ${key} at ${head.slice(0, 8)} — the agent was not asked\n`);
          return { kind: "exit", code: 0 };
        }

        if (rest.includes("--skip")) {
          await ctx.stdout.write(
            `skipped the agent — nothing stored for ${key} at ${head.slice(0, 8)}, Start here opens empty\n`,
          );
          return { kind: "exit", code: 0 };
        }

        await ctx.stdout.write(`asking ${agentCommand()} (${agentModel()}) about ${files.length} changed file(s)…\n`);
        let reply: string;
        try {
          reply = askAgent(repoRoot, buildPrompt(files, GENERATE_LIMIT), GENERATE_TIMEOUT_MS);
        } catch (error) {
          await ctx.stderr.write(`${agentCommand()} failed — ${spawnFailure(error)}\n`);
          return { kind: "exit", code: 1 };
        }

        const suggestions = parseSuggestions(reply, new Set(files.map((file) => file.path)));
        if (suggestions.length === 0) {
          await ctx.stderr.write("no usable ranking in the reply — nothing written\n");
          return { kind: "exit", code: 1 };
        }

        const at = new Date().toISOString();
        const ranked = suggestions.map((suggestion) =>
          suggestion.why ? { ...suggestion, at } : { path: suggestion.path, at },
        );
        writeMarks(repoRoot, ranked);
        writeRanking(key, head, { at, marks: ranked });
        for (const suggestion of suggestions) {
          await ctx.stdout.write(suggestion.why ? `${suggestion.path}  — ${suggestion.why}\n` : `${suggestion.path}\n`);
        }
        await ctx.stdout.write(`wrote ${suggestions.length} mark(s), replacing ${marks.length}\n`);
        return { kind: "exit", code: 0 };
      }

      if (subcommand === "list") {
        if (rest.includes("--json")) {
          await ctx.stdout.write(`${JSON.stringify({ repoRoot, marks }, null, 2)}\n`);
          return { kind: "exit", code: 0 };
        }
        if (marks.length === 0) {
          await ctx.stdout.write(`no marks for ${repoRoot}\n`);
          return { kind: "exit", code: 0 };
        }
        for (const mark of marks) {
          await ctx.stdout.write(mark.why ? `${mark.path}  — ${mark.why}\n` : `${mark.path}\n`);
        }
        return { kind: "exit", code: 0 };
      }

      if (subcommand === "clear") {
        if (!rest.includes("--yes")) {
          await ctx.stderr.write("refusing to clear without --yes\n");
          return { kind: "exit", code: 2 };
        }
        writeMarks(repoRoot, []);
        await ctx.stdout.write(`cleared ${marks.length} mark(s)\n`);
        return { kind: "exit", code: 0 };
      }

      if (subcommand !== "add" && subcommand !== "rm") {
        await ctx.stderr.write(`unknown subcommand: ${subcommand}\n\n${USAGE}`);
        return { kind: "exit", code: 2 };
      }

      const whyIndex = rest.indexOf("--why");
      const why = whyIndex >= 0 ? rest[whyIndex + 1] : undefined;
      if (whyIndex >= 0 && (why === undefined || why.startsWith("--"))) {
        await ctx.stderr.write("--why needs a reason\n");
        return { kind: "exit", code: 2 };
      }
      const inputs = (whyIndex >= 0 ? rest.slice(0, whyIndex).concat(rest.slice(whyIndex + 2)) : rest).filter(
        (token) => !token.startsWith("--"),
      );
      if (inputs.length === 0) {
        await ctx.stderr.write(`${subcommand} needs at least one path\n`);
        return { kind: "exit", code: 2 };
      }

      const paths = inputs.map((input) => toRepoPath(repoRoot, input, ctx.cwd));
      const outside = paths.filter((path) => path.startsWith("../") || path.length === 0);
      if (outside.length > 0) {
        await ctx.stderr.write(`outside ${repoRoot}: ${outside.join(", ")}\n`);
        return { kind: "exit", code: 2 };
      }

      if (subcommand === "rm") {
        const kept = marks.filter((mark) => !paths.includes(mark.path));
        writeMarks(repoRoot, kept);
        await ctx.stdout.write(`dropped ${marks.length - kept.length} mark(s)\n`);
        return { kind: "exit", code: 0 };
      }

      const at = new Date().toISOString();
      const next = marks.filter((mark) => !paths.includes(mark.path));
      for (const path of paths) next.push(why === undefined ? { path, at } : { path, why, at });
      writeMarks(repoRoot, next);
      await ctx.stdout.write(`marked ${paths.length} file(s); ${next.length} total\n`);
      return { kind: "exit", code: 0 };
    },
  );
}
