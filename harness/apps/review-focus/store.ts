import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface FocusMark {
  path: string;
  why?: string;
  at: string;
}

export interface ReviewedFileState {
  /** Digest of the file's patch text when these hunks were marked — a changed digest means the diff moved and the state is stale. */
  patchHash: string;
  hunks: number[];
  fileReviewed: boolean;
}

/** One inline note, in the shape `hunk session comment apply --stdin` reads back. */
export interface SavedComment {
  filePath: string;
  side: "old" | "new";
  line: number;
  summary: string;
}

interface StoreShape {
  version: 1;
  repos: Record<string, { marks: FocusMark[] }>;
}

/** One agent ranking. Its file name is its identity, so nothing inside it is a cache key. */
export interface StoredRanking {
  at: string;
  marks: FocusMark[];
}

interface CommentStoreShape {
  version: 1;
  reviews: Record<string, Record<string, SavedComment>>;
}

interface ReviewedStoreShape {
  version: 1;
  repos: Record<string, Record<string, ReviewedFileState>>;
}

const VCS_DIRECTORIES = [".git", ".jj", ".sl", ".hg"];

export function findRepoRoot(from: string): string {
  let current = resolve(from);
  for (;;) {
    if (VCS_DIRECTORIES.some((entry) => existsSync(join(current, entry)))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(from);
    current = parent;
  }
}

function statePath(name: string): string {
  const stateHome = process.env.XDG_STATE_HOME?.trim();
  const base = stateHome && stateHome.length > 0 ? stateHome : join(homedir(), ".local", "state");
  return join(base, "review-focus", name);
}

export function storePath(): string {
  return statePath("marks.json");
}

function readStore(): StoreShape {
  const file = storePath();
  if (!existsSync(file)) return { version: 1, repos: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StoreShape>;
    return { version: 1, repos: parsed.repos ?? {} };
  } catch {
    return { version: 1, repos: {} };
  }
}

function writeStore(store: StoreShape): void {
  const file = storePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

export function readMarks(repoRoot: string): FocusMark[] {
  return readStore().repos[repoRoot]?.marks ?? [];
}

export function writeMarks(repoRoot: string, marks: readonly FocusMark[]): void {
  const store = readStore();
  if (marks.length === 0) delete store.repos[repoRoot];
  else store.repos[repoRoot] = { marks: [...marks] };
  writeStore(store);
}

export function toRepoPath(repoRoot: string, input: string, cwd: string): string {
  const absolute = isAbsolute(input) ? input : resolve(cwd, input);
  return relative(repoRoot, absolute).split(sep).join("/");
}

function reviewedStorePath(): string {
  return statePath("reviewed.json");
}

function readReviewedStore(): ReviewedStoreShape {
  const file = reviewedStorePath();
  if (!existsSync(file)) return { version: 1, repos: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<ReviewedStoreShape>;
    return { version: 1, repos: parsed.repos ?? {} };
  } catch {
    return { version: 1, repos: {} };
  }
}

function writeReviewedStore(store: ReviewedStoreShape): void {
  const file = reviewedStorePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

export function readReviewed(repoRoot: string): Record<string, ReviewedFileState> {
  return readReviewedStore().repos[repoRoot] ?? {};
}

export function writeReviewedFile(repoRoot: string, path: string, state: ReviewedFileState | null): void {
  const store = readReviewedStore();
  const repo = { ...(store.repos[repoRoot] ?? {}) };
  if (state === null) delete repo[path];
  else repo[path] = state;
  if (Object.keys(repo).length === 0) delete store.repos[repoRoot];
  else store.repos[repoRoot] = repo;
  writeReviewedStore(store);
}

export function commentStorePath(): string {
  return statePath("comments.json");
}

// A prx worktree is thrown away after every run, so its path cannot key the notes taken in
// it. prx exports the pull request it opened as PRX_REVIEW_KEY, and that key is what carries
// notes from one run to the next; anywhere else the repository root is key enough.
export function reviewKey(repoRoot: string): string {
  const declared = process.env.PRX_REVIEW_KEY?.trim();
  return declared && declared.length > 0 ? declared : repoRoot;
}

function readCommentStore(): CommentStoreShape {
  const file = commentStorePath();
  if (!existsSync(file)) return { version: 1, reviews: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<CommentStoreShape>;
    return { version: 1, reviews: parsed.reviews ?? {} };
  } catch {
    return { version: 1, reviews: {} };
  }
}

function writeCommentStore(store: CommentStoreShape): void {
  const file = commentStorePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

export function readComments(key: string): Record<string, SavedComment> {
  return readCommentStore().reviews[key] ?? {};
}

export function writeComment(key: string, noteId: string, comment: SavedComment | null): void {
  const store = readCommentStore();
  const review = { ...(store.reviews[key] ?? {}) };
  if (comment === null) delete review[noteId];
  else review[noteId] = comment;
  if (Object.keys(review).length === 0) delete store.reviews[key];
  else store.reviews[key] = review;
  writeCommentStore(store);
}

// One file per review and commit, so reading the ranking is a file lookup and nothing has to
// be compared: `<review>__<commit>.json` exists means this pull request was already ranked at
// this commit. Older commits keep their own files rather than being overwritten.
export function rankingPath(key: string, commit: string): string {
  const slug = key.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
  return statePath(join("rankings", `${slug}__${commit}.json`));
}

export function readRanking(key: string, commit: string): StoredRanking | null {
  const file = rankingPath(key, commit);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StoredRanking>;
    return Array.isArray(parsed.marks) ? { at: parsed.at ?? "", marks: parsed.marks } : null;
  } catch {
    return null;
  }
}

export function writeRanking(key: string, commit: string, ranking: StoredRanking): void {
  const file = rankingPath(key, commit);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(ranking, null, 2)}\n`, { mode: 0o600 });
}
