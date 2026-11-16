import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const runCommand = promisify(execFile);
export const PinPrPattern = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)(?:[/?#]|$)/;
export const PinPrStatus = z.object({
  title: z.string(),
  detail: z.string(),
  checkedAt: z.number(),
});
export type PinPrStatus = z.infer<typeof PinPrStatus>;

interface PrCheck {
  workflowName?: string;
  name?: string;
  context?: string;
  startedAt?: string;
  status?: string;
  conclusion?: string;
  state?: string | null;
}

interface PrView {
  title: string;
  state: string;
  isDraft: boolean;
  reviewDecision?: string;
  reviewRequests?: unknown[];
  mergeable?: string;
  statusCheckRollup?: PrCheck[];
}

const reviewLabels: Record<string, string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REVIEW_REQUIRED: "Review needed",
};
const passedChecks = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const pendingChecks = new Set(["PENDING", "EXPECTED"]);

export function parsePinPrStatus(view: PrView, checkedAt: number): PinPrStatus {
  const latest = new Map<string, PrCheck>();
  for (const check of view.statusCheckRollup ?? []) {
    const key = `${check.workflowName ?? ""}|${check.name ?? check.context ?? ""}`;
    const previous = latest.get(key);
    if (previous === undefined || (check.startedAt ?? "") >= (previous.startedAt ?? "")) latest.set(key, check);
  }
  const outcomes = [...latest.values()].map(check => {
    if (check.state != null) return check.state === "SUCCESS" ? "passed" : pendingChecks.has(check.state) ? "pending" : "failed";
    if (check.status !== "COMPLETED") return "pending";
    return passedChecks.has(check.conclusion ?? "") ? "passed" : "failed";
  });
  const passed = outcomes.filter(outcome => outcome === "passed").length;
  const ci = outcomes.length === 0 ? "No CI" : `${outcomes.includes("failed") ? "CI failed" : outcomes.includes("pending") ? "CI running" : "CI passed"} ${passed}/${outcomes.length}`;
  const state = view.state === "OPEN" && view.isDraft ? "Draft" : view.state.toLowerCase();
  const review = reviewLabels[view.reviewDecision ?? ""] ?? ((view.reviewRequests?.length ?? 0) > 0 ? "Review needed" : "");
  return {
    title: view.title,
    detail: [state, ci, review, view.mergeable === "CONFLICTING" ? "Merge conflicts" : ""].filter(Boolean).join(" · "),
    checkedAt,
  };
}

export async function fetchPinPrStatus(url: string): Promise<PinPrStatus> {
  const { stdout } = await runCommand("gh", [
    "pr", "view", url, "--json", "title,state,isDraft,reviewDecision,reviewRequests,mergeable,statusCheckRollup",
  ], { timeout: 20_000 });
  return parsePinPrStatus(JSON.parse(stdout) as PrView, Date.now());
}
