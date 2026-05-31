/**
 * Session quality scoring formula — shared between Pi and Claude Code.
 * Extracted from Pi index.ts:703-728.
 */

import type { SessionEstimate } from "./types";

export function computeSessionScore(
  frictionCount: number,
  userMessages: number,
  assistantTurns: number,
  editsPerFile: Map<string, number>,
  toolFailures: number,
): SessionEstimate {
  const thrashFiles = [...editsPerFile.values()].filter((count) => count >= 4).length;

  let quality = 10;
  quality -= Math.min(4, Math.round(frictionCount * 0.6));
  quality -= Math.min(4, Math.floor(userMessages / 5));

  let efficiency = 10;
  if (assistantTurns > 40) efficiency -= 5;
  else if (assistantTurns > 24) efficiency -= 3;
  else if (assistantTurns > 12) efficiency -= 1;
  efficiency -= Math.min(3, thrashFiles);

  let stability = 10;
  stability -= Math.min(6, Math.round(toolFailures * 1.4));
  stability -= Math.min(2, thrashFiles);

  quality = Math.max(1, Math.min(10, quality));
  efficiency = Math.max(1, Math.min(10, efficiency));
  stability = Math.max(1, Math.min(10, stability));

  const weighted = (quality * 0.45) + (efficiency * 0.3) + (stability * 0.25);
  const combined = Math.max(1, Math.min(10, Math.round(weighted)));

  return { combined, quality, efficiency, stability };
}

export function scoreLabel(score: number): string {
  if (score >= 9) return "excellent";
  if (score >= 7) return "good";
  if (score >= 5) return "mixed";
  if (score >= 3) return "poor";
  return "awful";
}
