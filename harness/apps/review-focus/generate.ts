import { execFileSync } from "node:child_process";

export interface ChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

export interface Suggestion {
  readonly path: string;
  readonly why?: string;
}

export function parseNumstat(stdout: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of stdout.split("\n")) {
    const [additions, deletions, ...rest] = line.split("\t");
    const path = rest.join("\t").trim();
    if (!path || additions === undefined || deletions === undefined) continue;
    files.push({
      path,
      additions: Number.parseInt(additions, 10) || 0,
      deletions: Number.parseInt(deletions, 10) || 0,
    });
  }
  return files;
}

export function buildPrompt(files: readonly ChangedFile[], limit: number): string {
  const listing = files.map((file) => `${file.path}\t+${file.additions}\t-${file.deletions}`).join("\n");
  return [
    "You are ranking the files of a code review by what a human should read first.",
    "",
    "Changed files, one per line as `path<TAB>+additions<TAB>-deletions`:",
    listing,
    "",
    "Read the files you need with your own tools — you are running in the repository root.",
    `Return at most ${limit} files, most-worth-reading first.`,
    "",
    "Each `why` names what a reviewer must verify in that file — the specific thing that could",
    "be wrong. It is not a summary of what the file is or how much of it changed:",
    '  wanted:  "new token path, no test covers the refresh branch"',
    '  wanted:  "drops the stale-hash check, so old marks can outlive their diff"',
    '  useless: "main component for the review UI and ordering logic (242 additions)"',
    "A reviewer already knows what the file is; only the risk is worth a line.",
    "",
    "Answer with JSON and nothing else: an array of objects with a `path` (exactly as listed",
    "above) and a `why` of at most 120 characters.",
    'Example: [{"path":"src/auth.ts","why":"new token path, no test covers the refresh branch"}]',
  ].join("\n");
}

/** Pull the JSON array out of an agent reply that may carry prose or a code fence around it. */
export function parseSuggestions(stdout: string, known: ReadonlySet<string>): Suggestion[] {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const { path, why } = entry as { path?: unknown; why?: unknown };
    if (typeof path !== "string" || !known.has(path) || seen.has(path)) continue;
    seen.add(path);
    const reason = typeof why === "string" ? why.trim() : "";
    suggestions.push(reason ? { path, why: reason } : { path });
  }
  return suggestions;
}

export function changedFiles(repoRoot: string, revisions: readonly string[]): ChangedFile[] {
  const stdout = execFileSync("git", ["diff", "--numstat", ...revisions], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return parseNumstat(stdout);
}

// The agent binary comes from the environment, never from `hunk.config`: extension config is
// layered user-then-repo, so a repository under review could otherwise name what gets executed.
export function headCommit(repoRoot: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

export function agentCommand(): string {
  const declared = process.env.REVIEW_FOCUS_AGENT?.trim();
  return declared && declared.length > 0 ? declared : "claude";
}

// Ranking is a triage pass, not a review: it names the files and one line each, and the
// slower tiers spent minutes on it. The whole point is to answer before the TUI opens.
export function agentModel(): string {
  const declared = process.env.REVIEW_FOCUS_AGENT_MODEL?.trim();
  return declared && declared.length > 0 ? declared : "haiku";
}

export function askAgent(repoRoot: string, prompt: string, timeoutMs: number): string {
  return execFileSync(agentCommand(), ["-p", "--model", agentModel(), prompt], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// A failed spawn carries what the operator needs on `stderr` and `status`, not in `message`
// ("Command failed"). Reporting only the message left a silent empty pane behind a run that
// had in fact printed the reason.
export function spawnFailure(error: unknown): string {
  const detail = error as { message?: string; status?: number | null; signal?: string | null; stderr?: unknown };
  const stderr = typeof detail.stderr === "string" ? detail.stderr.trim() : "";
  const cause = detail.signal === "SIGTERM" ? "timed out" : `exit ${detail.status ?? "?"}`;
  return [`${cause}: ${detail.message ?? String(error)}`, stderr].filter((part) => part.length > 0).join("\n");
}
