#!/usr/bin/env node
// zcore-tags.mjs — Extract + tally tags across an Obsidian vault.
// Sources: YAML frontmatter `tags:` (flow `[a, b]`, block `- a`, or bare CSV) and inline `#hashtags`.
// Usage: node zcore-tags.mjs <vault-dir> [--json]
// Output (default): "<count>\t<tag>\t<sources>" sorted by count desc. Sources = fm|inline|both.
// --json: {tag: {count, files:[...], forms:{fm,inline}}} for downstream dedup tooling.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const vault = process.argv[2];
const asJson = process.argv.includes('--json');
if (!vault) {
  console.error('usage: zcore-tags.mjs <vault-dir> [--json]');
  process.exit(1);
}

const SKIP = new Set(['.obsidian', '.trash', '.git', '.zk', '!archive', 'node_modules', 'assets']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

// tag -> { count, files:Set, fm:0, inline:0 }
const tags = new Map();
function bump(tag, file, form) {
  tag = tag.trim();
  if (!tag) return;
  let e = tags.get(tag);
  if (!e) tags.set(tag, (e = { count: 0, files: new Set(), fm: 0, inline: 0 }));
  e.count++;
  e.files.add(file);
  e[form]++;
}

const clean = (t) => t.trim().replace(/^["']|["']$/g, '').trim();

function frontmatterTags(content, file) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return;
  const block = m[1];
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^tags\s*:\s*(.*)$/i);
    if (!km) continue;
    let inline = km[1].trim();
    if (inline.startsWith('[')) {
      // flow array, possibly spanning multiple lines until the closing ]
      let buf = inline;
      let j = i;
      while (!buf.includes(']') && j + 1 < lines.length) buf += ' ' + lines[++j].trim();
      buf
        .replace(/^\[|\].*$/g, '')
        .split(',')
        .map(clean)
        .forEach((t) => bump(t, file, 'fm'));
    } else if (inline && !inline.startsWith('#')) {
      // bare CSV or single scalar on the same line
      inline.split(',').map(clean).forEach((t) => bump(t, file, 'fm'));
    }
    // block list form: subsequent `  - tag` lines
    for (let j = i + 1; j < lines.length; j++) {
      const bm = lines[j].match(/^\s*-\s+(.+)$/);
      if (!bm) break;
      bump(clean(bm[1]), file, 'fm');
    }
  }
}

function inlineTags(content, file) {
  // strip frontmatter + fenced code before scanning inline hashtags
  const body = content.replace(/^---\n[\s\S]*?\n---/, '').replace(/```[\s\S]*?```/g, '');
  const re = /(?:^|\s)#([A-Za-zЀ-ӿ][\wЀ-ӿ/-]*)/g;
  let m;
  while ((m = re.exec(body))) bump(m[1], file, 'inline');
}

const files = walk(vault);
for (const f of files) {
  const content = readFileSync(f, 'utf8');
  const rel = relative(vault, f);
  frontmatterTags(content, rel);
  inlineTags(content, rel);
}

const sorted = [...tags.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));

if (asJson) {
  const out = {};
  for (const [tag, e] of sorted)
    out[tag] = { count: e.count, forms: { fm: e.fm, inline: e.inline }, files: [...e.files].sort() };
  console.log(JSON.stringify({ scanned: files.length, unique: sorted.length, tags: out }, null, 2));
} else {
  console.log(`# scanned ${files.length} notes, ${sorted.length} unique tags`);
  for (const [tag, e] of sorted) {
    const src = e.fm && e.inline ? 'both' : e.fm ? 'fm' : 'inline';
    console.log(`${e.count}\t${tag}\t${src}`);
  }
}
