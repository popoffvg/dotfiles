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

interface StoreShape {
  version: 1;
  repos: Record<string, { marks: FocusMark[] }>;
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

export function storePath(): string {
  const stateHome = process.env.XDG_STATE_HOME?.trim();
  const base = stateHome && stateHome.length > 0 ? stateHome : join(homedir(), ".local", "state");
  return join(base, "review-focus", "marks.json");
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
  const stateHome = process.env.XDG_STATE_HOME?.trim();
  const base = stateHome && stateHome.length > 0 ? stateHome : join(homedir(), ".local", "state");
  return join(base, "review-focus", "reviewed.json");
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
