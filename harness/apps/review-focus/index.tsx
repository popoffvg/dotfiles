import { createHash } from "node:crypto";
import { useMemo, useSyncExternalStore } from "react";
import type { ExtensionDiffFile, ExtensionPaneProps, HunkExtensionAPI } from "hunkdiff/extension";
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
  readMarks,
  readReviewed,
  toRepoPath,
  writeMarks,
  writeReviewedFile,
  type FocusMark,
  type ReviewedFileState,
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

  publish({
    ...snapshot,
    reviewed: { ...snapshot.reviewed, [filePath]: next },
    reviewedHunkCount: snapshot.reviewedHunkCount - previousContribution + nextContribution,
    reviewedFileCount: snapshot.reviewedFileCount + fileCountDelta,
  });

  writeReviewedFile(repoRoot, filePath, {
    patchHash: next.patchHash,
    hunks: [...next.reviewedHunks],
    fileReviewed: next.fileReviewed,
  });
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

function StartHerePane({ files, selectedFileId, theme, width, actions }: ExtensionPaneProps) {
  const focus = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  // Marked (★) files, plus any file with review progress even if never marked — reviewed
  // state must stay visible here, not just for the files you also flagged important.
  const listed = useMemo(
    () => files.filter((file) => focus.tiers[file.path] === "focused" || focus.reviewed[file.path] !== undefined),
    [files, focus],
  );
  const demoted = focus.counts.test + focus.counts.generated;
  const wrap = Math.max(12, width - 4);

  return (
    <scrollbox
      width="100%"
      height="100%"
      focused={false}
      scrollY={true}
      rootOptions={{ backgroundColor: theme.panel }}
      wrapperOptions={{ backgroundColor: theme.panel }}
      viewportOptions={{ backgroundColor: theme.panel }}
      contentOptions={{ backgroundColor: theme.panel }}
      verticalScrollbarOptions={{ visible: false }}
      horizontalScrollbarOptions={{ visible: false }}
    >
      <box style={{ width: "100%", flexDirection: "column", backgroundColor: theme.panel }}>
        <text content=" Start here" style={{ fg: theme.accent, bg: theme.panel }} />
        {focus.totalHunkCount > 0 ? (
          <text
            content={` ${focus.reviewedFileCount} file(s), ${focus.reviewedHunkCount}/${focus.totalHunkCount} hunks reviewed`}
            style={{ fg: theme.muted, bg: theme.panel }}
          />
        ) : null}
        {listed.length === 0 ? (
          <text content=" nothing marked or reviewed yet" style={{ fg: theme.muted, bg: theme.panel }} />
        ) : null}
        {listed.flatMap((file) => {
          const selected = file.id === selectedFileId;
          const marked = focus.tiers[file.path] === "focused";
          const reason = focus.reasons[file.path];
          const progress = focus.reviewed[file.path];
          const mark = progress?.fileReviewed ? "✓" : progress && progress.reviewedHunks.size > 0 ? "·" : " ";
          const rows = [
            <text
              key={`${file.id}:path`}
              content={` ${mark} ${marked ? "★ " : "  "}${file.path}`}
              style={{ fg: selected ? theme.accent : theme.text, bg: selected ? theme.selectedHunk : theme.panel }}
              onMouseDown={() => actions.selectFile(file.id)}
            />,
            <text
              key={`${file.id}:stats`}
              content={`    +${file.stats.additions} -${file.stats.deletions}`}
              style={{ fg: theme.muted, bg: theme.panel }}
            />,
          ];
          if (reason) {
            rows.push(
              <text
                key={`${file.id}:why`}
                content={`    ▸ ${reason.slice(0, wrap * 3)}`}
                style={{ fg: theme.accentMuted, bg: theme.panel }}
              />,
            );
          }
          return rows;
        })}
        {demoted > 0 ? (
          <text
            content={` moved down: ${focus.counts.test} test, ${focus.counts.generated} generated`}
            style={{ fg: theme.muted, bg: theme.panel }}
          />
        ) : null}
      </box>
    </scrollbox>
  );
}

const USAGE = [
  "Usage:",
  "  hunk focus add <path...> [--why <reason>]   mark files worth reading first",
  "  hunk focus rm <path...>                     drop marks",
  "  hunk focus list [--json]                    show marks for this repo",
  "  hunk focus clear --yes                      drop every mark for this repo",
  "",
  "Marks are read when a review loads; run `hunk session reload --repo .` to apply",
  "them to a window that is already open.",
  "",
].join("\n");

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
    width: { preferred: 36, min: 24, fraction: 0.22 },
    defaultOpen: readMarks(findRepoRoot(process.cwd())).length > 0,
    available: () => snapshot.counts.focused > 0 || snapshot.reviewedHunkCount > 0,
    component: StartHerePane,
  });

  hunk.registerCommand({ id: "toggle", title: "Toggle start-here pane", key: "ctrl+f" }, (ctx) => {
    ctx.panes.toggle("start-here");
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
