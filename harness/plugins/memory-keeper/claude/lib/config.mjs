import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_PATH = join(homedir(), ".claude", "memory-keeper.local.md");

export function loadConfig() {
  let content;
  try {
    content = readFileSync(CONFIG_PATH, "utf8");
  } catch {
    return {};
  }

  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const config = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith("~")) val = val.replace("~", homedir());
    if (key && val) config[key] = val;
  }
  return config;
}
