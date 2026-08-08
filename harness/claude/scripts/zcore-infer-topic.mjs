#!/usr/bin/env node
// zcore-infer-topic.mjs — Infer and assign `topic:` frontmatter to notes without existing topics
// Reads from work list and infers topics from title, URL, and opening content
//
// Usage: node zcore-infer-topic.mjs <work-list-file> <vault-dir> <progress-log> [--apply]
//   reads note paths from work-list (one per line)
//   infers topics from URL and content
//   logs results to progress-log

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const workListFile = process.argv[2];
const vaultDir = process.argv[3];
const progressLog = process.argv[4];
const APPLY = process.argv.includes('--apply');

if (!workListFile || !vaultDir || !progressLog) {
  console.error('usage: zcore-infer-topic.mjs <work-list> <vault-dir> <progress-log> [--apply]');
  process.exit(1);
}

const TOPICS = [
  'ai', 'database', 'distributed-systems', 'architecture', 'golang', 'other',
  'system-programming', 'performance', 'infrastructure', 'knowledge-management',
  'security', 'career', 'productivity', 'testing', 'management', 'data-science',
];

// Keywords → topics for URL and content inference
const KEYWORD_TOPICS = {
  'ai': ['ai', 'llm', 'agent', 'gpt', 'claude', 'anthropic', 'transformer', 'embeddings', 'rag', 'prompt', 'neural', 'deep-learning'],
  'data-science': ['data', 'analytics', 'visualization', 'statistics', 'dataset', 'etl', 'bigquery', 'tableau', 'dbt', 'pandas'],
  'database': ['database', 'postgres', 'mysql', 'mongodb', 'redis', 'sql', 'nosql', 'indexing', 'query', 'schema', 'oltp', 'clickhouse', 'snowflake'],
  'distributed-systems': ['distributed', 'raft', 'consensus', 'replication', 'kafka', 'queue', 'partition', 'sharding', 'p2p', 'gossip'],
  'golang': ['golang', 'go-lang', 'goroutine', 'goland'],
  'system-programming': ['rust', 'c++', 'cpp', 'kernel', 'linux', 'memory', 'allocation', 'concurrency', 'thread', 'cpu', 'assembly', 'unsafe', 'rayon'],
  'performance': ['performance', 'optimization', 'benchmark', 'profiling', 'latency', 'throughput', 'async', 'cache'],
  'infrastructure': ['kubernetes', 'k8s', 'docker', 'devops', 'terraform', 'ansible', 'aws', 'gcp', 'azure', 'ci/cd', 'deployment'],
  'architecture': ['architecture', 'design-pattern', 'microservice', 'api', 'rest', 'grpc', 'cqrs', 'event-driven', 'ddd'],
  'security': ['security', 'auth', 'encryption', 'crypto', 'vulnerability', 'sandbox'],
  'testing': ['testing', 'unit-test', 'integration-test', 'tdd', 'bdd', 'pytest', 'jest', 'mocha'],
  'productivity': ['productivity', 'tool', 'cli', 'workflow', 'automation', 'script'],
  'management': ['management', 'leadership', 'team', 'agile', 'scrum', 'kanban', 'sprint'],
  'career': ['career', 'interview', 'job', 'hiring', 'mentoring'],
  'knowledge-management': ['knowledge', 'pkm', 'obsidian', 'zettelkasten', 'note-taking', 'wiki'],
};

function inferTopicsFromUrl(url) {
  const topics = new Set();
  const urlLower = url.toLowerCase();

  for (const [topic, keywords] of Object.entries(KEYWORD_TOPICS)) {
    for (const kw of keywords) {
      if (urlLower.includes(kw)) {
        topics.add(topic);
        break;
      }
    }
  }

  return Array.from(topics).slice(0, 3);
}

function inferTopicsFromContent(title, url, content) {
  // Start with URL inference
  let topics = inferTopicsFromUrl(url);
  if (topics.length > 0) return topics;

  // Fall back to content inference
  const text = (title + ' ' + content).toLowerCase();
  const hits = new Set();

  for (const [topic, keywords] of Object.entries(KEYWORD_TOPICS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        hits.add(topic);
        break;
      }
    }
  }

  if (hits.size > 0) return Array.from(hits).slice(0, 3);

  // Default to 'other' if nothing matches
  return ['other'];
}

function readFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

function extractTitle(fm) {
  const match = fm.match(/^title\s*:\s*(.+)$/im);
  return match ? match[1].trim() : '';
}

function extractUrl(fm) {
  const match = fm.match(/^url\s*:\s*(.+)$/im);
  return match ? match[1].trim() : '';
}

function extractContent(content) {
  // Get content after frontmatter, first 200 words
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!fmMatch) return '';
  const body = fmMatch[1];
  const text = body.replace(/[#*_\[\]()]/g, ' ').replace(/\s+/g, ' ');
  return text.slice(0, 1000);
}

function hasTopic(fm) {
  return /^topic\s*:/im.test(fm);
}

function withTopic(content, topics) {
  const m = content.match(/^(---\n)([\s\S]*?)(\n---\n?)/);
  if (!m) return null;
  let body = m[2].split('\n').filter((l) => !/^topic\s*:/.test(l)).join('\n');
  const topicLine = `topic: [${topics.join(', ')}]`;
  return `${m[1]}${topicLine}\n${body}${m[3]}${content.slice(m[0].length)}`;
}

// Read work list
const lines = readFileSync(workListFile, 'utf8').split('\n').filter(l => l.trim());
console.log(`Processing ${lines.length} items from work list...`);

let ok = 0, already = 0, skip = 0, startIdx = 0;

// Find last completed line from progress log
if (existsSync(progressLog)) {
  const log = readFileSync(progressLog, 'utf8');
  const lastLine = log.trim().split('\n').pop();
  if (lastLine && lastLine.includes('\t')) {
    const lastPath = lastLine.split('\t')[0];
    startIdx = lines.findIndex(l => l === lastPath) + 1;
  }
}

console.log(`Starting from item ${startIdx}...\n`);

for (let i = startIdx; i < lines.length; i++) {
  const relPath = lines[i].trim();
  if (!relPath) continue;

  const filePath = resolve(vaultDir, relPath);

  try {
    const content = readFileSync(filePath, 'utf8');
    const fm = readFrontmatter(content);

    if (!fm) {
      const msg = `${relPath}\tSKIP-NO-FM\t-`;
      console.log(msg);
      appendFileSync(progressLog, msg + '\n');
      skip++;
      continue;
    }

    if (hasTopic(fm)) {
      const msg = `${relPath}\tALREADY\t-`;
      console.log(msg);
      appendFileSync(progressLog, msg + '\n');
      already++;
      continue;
    }

    const title = extractTitle(fm);
    const url = extractUrl(fm);
    const bodyContent = extractContent(content);

    const topics = inferTopicsFromContent(title, url, bodyContent);
    const topicStr = topics.join(',');

    if (APPLY) {
      const next = withTopic(content, topics);
      if (next && next !== content) {
        writeFileSync(filePath, next);
        // Log write confirmation to stderr for debugging
        if (i % 50 === 0) console.error(`[WRITE] ${relPath}`);
      }
    }

    const msg = `${relPath}\tOK\t${topicStr}`;
    console.log(msg);
    appendFileSync(progressLog, msg + '\n');
    ok++;

    // Progress indicator every 50 items
    if ((ok + already) % 50 === 0) {
      console.log(`  [Progress: ${ok + already}/${lines.length}]`);
    }
  } catch (err) {
    const msg = `${relPath}\tERR\t${err.message.slice(0, 50)}`;
    console.error(msg);
    appendFileSync(progressLog, msg + '\n');
    skip++;
  }
}

console.log(`\nDone! Results: OK=${ok} ALREADY=${already} SKIP=${skip}`);
appendFileSync(progressLog, `\n--- Summary at item ${Math.min(startIdx + ok + already + skip, lines.length)} ---\n`);
