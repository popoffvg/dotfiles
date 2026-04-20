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
import { guard, inject } from "../common/hooks";

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

function logGuardDecision(data: {
  decision: "allow" | "block";
  reason?: string;
  toolName?: string;
}): void {
  try {
    const piDir = path.join(process.cwd(), ".pi");
    if (!fs.existsSync(piDir)) {
      fs.mkdirSync(piDir, { recursive: true });
    }

    const logPath = path.join(piDir, "work-guard.log");
    const ts = new Date().toISOString();
    const line = JSON.stringify({ ts, cwd: process.cwd(), ...data });
    fs.appendFileSync(logPath, line + "\n", "utf-8");
  } catch {
    // best effort
  }
}

switch (command) {
  case "guard": {
    const raw = readStdin();
    if (!raw || !raw.trim()) {
      const reason = "work-manager guard failed closed: empty hook input";
      logGuardDecision({ decision: "block", reason });
      out({ decision: "block", reason });
      break;
    }

    let parsed: { tool_name?: string; tool_input?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const reason = "work-manager guard failed closed: invalid hook JSON";
      logGuardDecision({ decision: "block", reason });
      out({ decision: "block", reason });
      break;
    }

    const toolName = parsed.tool_name || "";
    const toolInput = parsed.tool_input || {};

    if (!toolName.trim()) {
      const reason = "work-manager guard failed closed: missing tool_name";
      logGuardDecision({ decision: "block", reason });
      out({ decision: "block", reason });
      break;
    }

    const result = guard(process.cwd(), toolName, toolInput);
    if (!result.allowed) {
      logGuardDecision({ decision: "block", reason: result.reason, toolName });
      out({ decision: "block", reason: result.reason });
    } else {
      logGuardDecision({ decision: "allow", toolName });
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
