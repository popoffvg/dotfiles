#!/usr/bin/env node
// zcore-backfill-topic.mjs — Add a curated `topic` frontmatter field to Z-Core notes,
// derived from each note's EXISTING free-form `tags`. Additive: never edits `tags` or body.
//
// Usage: node zcore-backfill-topic.mjs <vault-dir> [--apply] [--layers=10-sources,20-notes]
//   default is DRY-RUN (reports coverage + distribution, writes nothing).
//   --apply writes the `topic:` line into each note's frontmatter.
//
// Mapping: a note's tags are looked up in TAG2TOPIC (high-confidence synonyms → one of the
// 16 approved topics). Matched topics are deduped (max 3). A note that HAS tags but none map
// falls back to `other`. A note with no tags is left untouched (can't infer). Notes that
// already carry a `topic:` are re-derived (idempotent).

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const vault = process.argv[2];
const APPLY = process.argv.includes('--apply');
const layersArg = process.argv.find((a) => a.startsWith('--layers='));
const LAYERS = (layersArg ? layersArg.split('=')[1] : '10-sources,20-notes').split(',');
if (!vault) {
  console.error('usage: zcore-backfill-topic.mjs <vault-dir> [--apply] [--layers=a,b]');
  process.exit(1);
}

const TOPICS = [
  'ai', 'database', 'distributed-systems', 'architecture', 'golang', 'other',
  'system-programming', 'performance', 'infrastructure', 'knowledge-management',
  'security', 'career', 'productivity', 'testing', 'management', 'data-science',
];

// Synonym → canonical topic. Conservative + high-confidence. Anything unlisted with tags
// present falls back to `other`; a note with no tags gets no topic.
const TAG2TOPIC = {
  // ai
  ai: 'ai', 'ai-ml': 'ai', llm: 'ai', llms: 'ai', 'llm-inference': 'ai', agents: 'ai',
  'ai-agents': 'ai', agentic: 'ai', 'agentic-ai': 'ai', 'multi-agent': 'ai', 'coding-agents': 'ai',
  rag: 'ai', mcp: 'ai', claude: 'ai', 'claude-code': 'ai', gpt: 'ai', anthropic: 'ai', openai: 'ai',
  transformers: 'ai', embeddings: 'ai', prompt: 'ai', prompting: 'ai', reasoning: 'ai',
  'chain-of-thought': 'ai', 'context-engineering': 'ai', 'kv-cache': 'ai', vllm: 'ai',
  'deep-learning': 'ai', 'neural-networks': 'ai', nlp: 'ai', inference: 'ai', 'fine-tuning': 'ai',
  // machine-learning is ML/DS — send to data-science; ai handles the LLM/agent side
  'machine-learning': 'data-science', ml: 'data-science',
  // database
  database: 'database', databases: 'database', db: 'database', sql: 'database', postgres: 'database',
  postgresql: 'database', mysql: 'database', redis: 'database', valkey: 'database',
  clickhouse: 'database', etcd: 'database', mongodb: 'database', nosql: 'database', kv: 'database',
  storage: 'database', oltp: 'database', olap: 'database', indexing: 'database',
  // distributed-systems
  'distributed-systems': 'distributed-systems', distributed: 'distributed-systems',
  raft: 'distributed-systems', consensus: 'distributed-systems', replication: 'distributed-systems',
  consistency: 'distributed-systems', p2p: 'distributed-systems', kafka: 'distributed-systems',
  'message-queue': 'distributed-systems', sqs: 'distributed-systems', pubsub: 'distributed-systems',
  sharding: 'distributed-systems', partitioning: 'distributed-systems',
  // architecture
  architecture: 'architecture', 'software-architecture': 'architecture',
  'system-design': 'architecture', system_design: 'architecture', ddd: 'architecture',
  'domain-driven-design': 'architecture', patterns: 'architecture', 'design-patterns': 'architecture',
  microservices: 'architecture', api: 'architecture', rest: 'architecture', grpc: 'architecture',
  'event-driven': 'architecture', cqrs: 'architecture', 'clean-architecture': 'architecture',
  refactoring: 'architecture', modernization: 'architecture',
  // golang
  golang: 'golang', go: 'golang', goroutines: 'golang', gopls: 'golang', slices: 'golang',
  // system-programming
  systems: 'system-programming', 'systems-programming': 'system-programming',
  'system-programming': 'system-programming', kernel: 'system-programming', linux: 'system-programming',
  os: 'system-programming', 'operating-systems': 'system-programming', cpu: 'system-programming',
  'cpu-architecture': 'system-programming', 'memory-management': 'system-programming',
  allocators: 'system-programming', concurrency: 'system-programming', networking: 'system-programming',
  tcp: 'system-programming', uefi: 'system-programming', bios: 'system-programming',
  assembly: 'system-programming', 'low-level': 'system-programming', embedded: 'system-programming',
  unsafe: 'system-programming', 'zero-copy': 'system-programming', 'file-system': 'system-programming',
  // performance
  performance: 'performance', optimization: 'performance', benchmarking: 'performance',
  profiling: 'performance', latency: 'performance', throughput: 'performance', perf: 'performance',
  // infrastructure
  infrastructure: 'infrastructure', infra: 'infrastructure', devops: 'infrastructure',
  devtools: 'infrastructure', tooling: 'infrastructure', kubernetes: 'infrastructure',
  k8s: 'infrastructure', docker: 'infrastructure', containers: 'infrastructure', aws: 'infrastructure',
  gcp: 'infrastructure', azure: 'infrastructure', cloud: 'infrastructure', terraform: 'infrastructure',
  ansible: 'infrastructure', 'ci-cd': 'infrastructure', 'platform-engineering': 'infrastructure',
  sre: 'infrastructure', observability: 'infrastructure', monitoring: 'infrastructure',
  telemetry: 'infrastructure', otel: 'infrastructure', deployment: 'infrastructure',
  'developer-experience': 'infrastructure',
  // knowledge-management
  'knowledge-management': 'knowledge-management', pkm: 'knowledge-management',
  'personal-knowledge-management': 'knowledge-management', 'knowledge-graph': 'knowledge-management',
  'knowledge-graphs': 'knowledge-management', zettelkasten: 'knowledge-management',
  'note-taking': 'knowledge-management', obsidian: 'knowledge-management',
  'second-brain': 'knowledge-management', wikilinks: 'knowledge-management',
  'semantic-search': 'knowledge-management',
  // security
  security: 'security', safety: 'security', sandboxing: 'security', vulnerabilities: 'security',
  cryptography: 'security', crypto: 'security', auth: 'security', authentication: 'security',
  authorization: 'security', infosec: 'security', appsec: 'security',
  // career
  career: 'career', interview: 'career', 'interview-prep': 'career', job: 'career', jobs: 'career',
  hiring: 'career', 'soft-skills': 'career', mentoring: 'career',
  // productivity
  productivity: 'productivity', tools: 'productivity', tool: 'productivity', cli: 'productivity',
  workflow: 'productivity', automation: 'productivity',
  // testing
  testing: 'testing', tests: 'testing', test: 'testing', tdd: 'testing', bdd: 'testing',
  'test-pyramid': 'testing', 'unit-testing': 'testing', 'integration-testing': 'testing',
  // management
  management: 'management', strategy: 'management', 'wardley-mapping': 'management',
  'team-topologies': 'management', dora: 'management', agile: 'management', scrum: 'management',
  'project-management': 'management', 'engineering-management': 'management', leadership: 'management',
  noestimates: 'management',
  // data-science
  'data-science': 'data-science', data: 'data-science', statistics: 'data-science',
  'causal-inference': 'data-science', econometrics: 'data-science', analytics: 'data-science',
  visualization: 'data-science', 'data-engineering': 'data-science', etl: 'data-science',
  // general dev → other (block 6 renamed to `other`)
  programming: 'other', 'software-development': 'other', 'software-engineering': 'other',
  software: 'other', engineering: 'other', python: 'other', java: 'other', rust: 'other',
  c: 'other', 'c++': 'other', cpp: 'other', zig: 'other', javascript: 'other', typescript: 'other',
  'open-source': 'other',
};

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const clean = (t) => t.trim().replace(/^["']|["']$/g, '').trim().toLowerCase();

// Read the `tags` values (flow / block / multi-line) from a frontmatter block.
function readTags(fmBlock) {
  const out = [];
  const lines = fmBlock.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^tags\s*:\s*(.*)$/i);
    if (!km) continue;
    let inline = km[1].trim();
    if (inline.startsWith('[')) {
      let buf = inline, j = i;
      while (!buf.includes(']') && j + 1 < lines.length) buf += ' ' + lines[++j].trim();
      buf.replace(/^\[|\].*$/g, '').split(',').map(clean).forEach((t) => t && out.push(t));
    } else if (inline && !inline.startsWith('#')) {
      inline.split(',').map(clean).forEach((t) => t && out.push(t));
    }
    for (let j = i + 1; j < lines.length; j++) {
      const bm = lines[j].match(/^\s*-\s+(.+)$/);
      if (!bm) break;
      out.push(clean(bm[1]));
    }
  }
  return out;
}

function deriveTopics(tags) {
  if (tags.length === 0) return [];
  const hits = [];
  for (const t of tags) {
    const topic = TAG2TOPIC[t];
    if (topic && !hits.includes(topic)) hits.push(topic);
  }
  if (hits.length === 0) return ['other']; // has tags but none mapped
  return hits.slice(0, 3);
}

// Insert or replace a `topic:` line right after the opening `---`.
function withTopic(content, topics) {
  const m = content.match(/^(---\n)([\s\S]*?)(\n---\n?)/);
  if (!m) return null;
  let body = m[2].split('\n').filter((l) => !/^topic\s*:/.test(l)).join('\n');
  const topicLine = `topic: [${topics.join(', ')}]`;
  return `${m[1]}${topicLine}\n${body}${m[3]}${content.slice(m[0].length)}`;
}

const files = LAYERS.flatMap((l) => walk(join(vault, l)));
const dist = Object.fromEntries(TOPICS.map((t) => [t, 0]));
let noTags = 0, changed = 0, noFm = 0;

for (const f of files) {
  const content = readFileSync(f, 'utf8');
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) {
    noFm++;
    continue;
  }
  const tags = readTags(fm[1]);
  const topics = deriveTopics(tags);
  if (topics.length === 0) {
    noTags++;
    continue;
  }
  topics.forEach((t) => (dist[t] = (dist[t] ?? 0) + 1));
  changed++;
  if (APPLY) {
    const next = withTopic(content, topics);
    if (next && next !== content) writeFileSync(f, next);
  }
}

console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'} — layers: ${LAYERS.join(', ')}`);
console.log(`scanned ${files.length} notes`);
console.log(`  topic assigned: ${changed}`);
console.log(`  no tags (skipped): ${noTags}`);
console.log(`  no frontmatter (skipped): ${noFm}`);
console.log('topic distribution:');
for (const [t, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  if (n) console.log(`  ${String(n).padStart(5)}  ${t}`);
}
