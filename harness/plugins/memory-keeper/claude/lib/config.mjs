import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_PATH = join(homedir(), ".config", "mem-keeper", "config.json");

function expandHome(value) {
  if (typeof value === "string" && value.startsWith("~")) {
    return value.replace(/^~(?=\/|$)/, homedir());
  }
  if (Array.isArray(value)) {
    return value.map(expandHome);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandHome(v)]));
  }
  return value;
}

export function loadConfig() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }

  const config = expandHome(parsed || {});
  if (!config.insights_root && config.insightsRoot) {
    config.insights_root = config.insightsRoot;
  }

  if (!config.classifier) config.classifier = {};
  if (!Array.isArray(config.classifier.llm) || config.classifier.llm.length === 0) {
    config.classifier.llm = [
      { name: "pi", sh: "pi -p ${prompt}" },
      { name: "claude", sh: "claude -p ${prompt}" },
    ];
  }
  if (!config.classifier.timeout_ms) config.classifier.timeout_ms = 120000;

  return config;
}
