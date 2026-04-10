/**
 * Execute FSM side effects.
 * This is the adapter layer — core returns effects, server executes them.
 */

import type { SideEffect, GitFn } from "../types";
import * as notes from "../notes";

export interface EffectContext {
  notesDir: string;
  cwd: string;
  git: GitFn;
  loadSkill: (name: string) => string;
}

/**
 * Execute a list of side effects and return accumulated messages.
 * Effects that produce user-visible output append to the messages array.
 */
export function executeEffects(
  effects: SideEffect[],
  ctx: EffectContext,
): string {
  const messages: string[] = [];

  for (const effect of effects) {
    switch (effect.kind) {
      case "worklog":
        notes.appendWorklog(ctx.notesDir, effect.entry);
        break;

      case "commit_notes":
        notes.commitNotes(ctx.notesDir, effect.message, ctx.git);
        break;

      case "inject_skill": {
        const skill = ctx.loadSkill(effect.skill);
        if (skill) {
          const parts = [skill];
          if (effect.context) {
            parts.push("\n---\n" + effect.context);
          }
          messages.push(parts.join("\n"));
        }
        break;
      }

      case "compact":
        // Compaction is advisory — Claude Code handles this via hooks/agent behavior.
        // We log the intent for the caller to act on.
        messages.push(`[compact] ${effect.summary}`);
        break;

      case "notify":
        messages.push(`[${effect.level}] ${effect.message}`);
        break;

      case "set_model":
        // Model switching is advisory — returned to caller for agent frontmatter.
        messages.push(`[model] Recommended: ${effect.model}`);
        break;

      case "ask_user":
        messages.push(
          `[question] ${effect.question}${effect.options ? "\nOptions: " + effect.options.join(", ") : ""}`,
        );
        break;

      case "block_tool":
        messages.push(`[blocked] ${effect.reason}`);
        break;
    }
  }

  return messages.join("\n\n");
}
