#!/usr/bin/env tsx
/**
 * Claude Code hook adapter.
 *
 * Reads Claude hook JSON from stdin, dispatches to common/hooks.ts,
 * writes Claude hook JSON to stdout.
 *
 * Usage:
 *   hook-runner.ts guard          # PreToolUse — stdin: { tool_name, tool_input }
 *   hook-runner.ts inject         # SessionStart / PostCompact
 *   hook-runner.ts cmux-inject    # SessionStart cmux context
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { guard, inject } from "../../common/hooks";

const command = process.argv[2];

function readStdin(): string {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function out(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj));
}

switch (command) {
  case "guard": {
    const raw = readStdin();
    if (!raw) break;

    let parsed: { tool_name?: string; tool_input?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      break;
    }

    const toolName = parsed.tool_name || "";
    const toolInput = parsed.tool_input || {};

    const result = guard(process.cwd(), toolName, toolInput);
    if (!result.allowed) {
      out({ decision: "block", reason: result.reason });
    }
    break;
  }

  case "inject": {
    const result = inject(process.cwd());
    if (result.additionalContext) {
      out({ additionalContext: result.additionalContext });
    }
    break;
  }

  case "cmux-inject": {
    // Only inject when running inside cmux
    if (!process.env.CMUX_SURFACE_ID) break;

    const cmuxPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "cmux-context.md",
    );

    let ctx: string;
    try {
      ctx = fs.readFileSync(cmuxPath, "utf-8");
    } catch {
      break;
    }

    if (ctx) out({ additionalContext: ctx });
    break;
  }
}
