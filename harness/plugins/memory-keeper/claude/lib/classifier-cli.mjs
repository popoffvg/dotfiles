// Classifier: shell out to a configured CLI (e.g. `claude -p`, `pi -p`).
// The plugin pipes the full prompt to stdin and reads stdout as the response text.
// Auth and model selection live entirely in the CLI — not in this plugin.

import { spawnSync } from "child_process";

export function runClassifier(prompt, cmd) {
  if (!cmd || !cmd.trim()) {
    throw new Error("classifier_command not set in memory-keeper.local.md");
  }
  const [bin, ...args] = cmd.trim().split(/\s+/);
  const res = spawnSync(bin, args, {
    input: prompt,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.error) throw new Error(`${bin} spawn error: ${res.error.message}`);
  if (res.status !== 0) {
    throw new Error(`${bin} exit ${res.status}: ${(res.stderr || "").slice(0, 300)}`);
  }
  return { text: (res.stdout || "").trim() };
}
