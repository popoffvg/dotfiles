// Ephemeral daily memory: theme-grouped facts under <insights_root>/_daily/<YYYY-MM-DD>.md.
// Retention is enforced by session-start (keeps only today + yesterday).

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

export function dailyDir(insightsRoot) {
  return join(insightsRoot, "_daily");
}

function todayStr(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nowHHMM(now = new Date()) {
  return now.toISOString().slice(11, 16);
}

function dailyFile(insightsRoot, date = todayStr()) {
  return join(dailyDir(insightsRoot), `${date}.md`);
}

/**
 * Append a fact under one or more theme sections in today's daily file.
 * If a theme section doesn't exist yet, it's created. Facts are stored as
 * bullets prefixed with HH:MM.
 *
 * `themes` may be a string or an array of 1-3 strings.
 */
export function appendDailyFact(insightsRoot, themes, fact, { now = new Date() } = {}) {
  if (!fact || typeof fact !== "string" || !fact.trim()) return null;
  const themeList = Array.isArray(themes) ? themes.filter(Boolean) : (themes ? [themes] : ["Misc"]);
  const finalThemes = themeList.slice(0, 3).map((t) => String(t).trim()).filter(Boolean);
  const safeThemes = finalThemes.length > 0 ? finalThemes : ["Misc"];

  mkdirSync(dailyDir(insightsRoot), { recursive: true });
  const path = dailyFile(insightsRoot, todayStr(now));
  const stamp = nowHHMM(now);
  const bullet = `- ${stamp} ${fact.trim()}`;

  let content = "";
  if (existsSync(path)) {
    content = readFileSync(path, "utf8");
  } else {
    content = `# Daily memory — ${todayStr(now)}\n`;
  }

  for (const theme of safeThemes) {
    const headingRe = new RegExp(`^## ${theme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
    if (headingRe.test(content)) {
      // Append bullet at end of this section (before next ## heading or EOF)
      const lines = content.split("\n");
      let inSection = false;
      let insertAt = lines.length;
      for (let i = 0; i < lines.length; i++) {
        if (headingRe.test(lines[i])) {
          inSection = true;
          continue;
        }
        if (inSection && /^## /.test(lines[i])) {
          insertAt = i;
          break;
        }
      }
      // Trim trailing blank lines inside the section
      while (insertAt > 0 && lines[insertAt - 1].trim() === "") insertAt--;
      lines.splice(insertAt, 0, bullet);
      content = lines.join("\n");
    } else {
      // Add a new section at the end
      if (!content.endsWith("\n")) content += "\n";
      content += `\n## ${theme}\n${bullet}\n`;
    }
  }

  writeFileSync(path, content);
  return path;
}

/**
 * Delete daily files whose date is older than `keepDays` days (default: keep today + yesterday).
 * Returns array of removed file paths.
 */
export function pruneOldDaily(insightsRoot, { keepDays = 2, now = new Date() } = {}) {
  const dir = dailyDir(insightsRoot);
  if (!existsSync(dir)) return [];

  const keep = new Set();
  for (let i = 0; i < keepDays; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    keep.add(d.toISOString().slice(0, 10));
  }

  const removed = [];
  for (const name of readdirSync(dir)) {
    const match = name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!match) continue;
    if (keep.has(match[1])) continue;
    const p = join(dir, name);
    try { unlinkSync(p); removed.push(p); } catch {}
  }
  return removed;
}
