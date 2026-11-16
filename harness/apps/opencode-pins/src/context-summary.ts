import { z } from "zod";

export const ContextSummary = z.object({ ids: z.array(z.string()), anchors: z.array(z.string()), text: z.string() });
export type ContextSummary = z.infer<typeof ContextSummary>;

interface ContextMessage {
  readonly id?: string;
  readonly role: string;
}

export function selectSummaryMessages<T extends ContextMessage>(messages: readonly T[], ids: ReadonlySet<string>): T[] {
  let selected = false;
  return messages.filter(message => {
    if (message.id !== undefined) selected = ids.has(message.id);
    else if (message.role === "user" || message.role === "system") selected = false;
    return selected;
  });
}

export function replaceSummaryMessages<T extends ContextMessage>(messages: readonly T[], summary: ContextSummary, replacement: T): T[] {
  const visible = new Set(messages.flatMap(message => message.id === undefined ? [] : [message.id]));
  if (!summary.anchors.every(id => visible.has(id))) return [...messages];
  const ids = new Set(summary.ids);
  let selected = false;
  let inserted = false;
  return messages.flatMap(message => {
    if (message.id !== undefined) selected = ids.has(message.id);
    else if (message.role === "user" || message.role === "system") selected = false;
    if (!selected) return [message];
    if (inserted) return [];
    inserted = true;
    return [replacement];
  });
}

export function mergeSummaryRange(summaries: readonly ContextSummary[], ids: readonly string[]): string[] {
  const merged = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const summary of summaries) {
      if (!summary.ids.some(id => merged.has(id))) continue;
      for (const id of summary.ids) {
        if (!merged.has(id)) { merged.add(id); changed = true; }
      }
    }
  }
  return [...merged];
}
