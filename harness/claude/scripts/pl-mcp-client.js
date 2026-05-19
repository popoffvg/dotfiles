#!/usr/bin/env node
/**
 * Minimal pl MCP client for testing blocks.
 * Usage: node pl-mcp-client.js <url> <method> [params-json]
 */
const http = require('http');
const https = require('https');
const url = require('url');

const MCP_URL = process.argv[2];
const METHOD = process.argv[3];
const PARAMS = process.argv[4] ? JSON.parse(process.argv[4]) : {};

if (!MCP_URL || !METHOD) {
  console.error('Usage: node pl-mcp-client.js <mcp-url> <method> [params-json]');
  process.exit(1);
}

let sessionId = null;

function post(body) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(MCP_URL);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;

    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
    };

    const req = lib.request(options, (res) => {
      if (res.headers['mcp-session-id']) sessionId = res.headers['mcp-session-id'];
      let buf = '';
      res.on('data', (chunk) => { buf += chunk.toString(); });
      res.on('end', () => {
        // Parse SSE events
        const events = buf.split('\n\n').filter(Boolean);
        const results = [];
        for (const evt of events) {
          for (const line of evt.split('\n')) {
            if (line.startsWith('data: ')) {
              try { results.push(JSON.parse(line.slice(6))); } catch (_) {}
            }
          }
        }
        resolve(results.length === 1 ? results[0] : results);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function call(method, params = {}) {
  return post({ jsonrpc: '2.0', id: Date.now(), method, params });
}

async function main() {
  // Initialize session
  const init = await call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'pl-mcp-client', version: '1.0' },
  });
  if (init.error) { console.error('Init error:', init.error); process.exit(1); }

  // Call tools/list first if requested
  if (METHOD === 'tools/list') {
    const r = await call('tools/list', {});
    console.log(JSON.stringify(r.result?.tools?.map(t => t.name) ?? r, null, 2));
    return;
  }

  // Call tools/call
  const r = await call('tools/call', { name: METHOD, arguments: PARAMS });
  if (r.error) { console.error('Error:', JSON.stringify(r.error, null, 2)); process.exit(1); }
  const content = r.result?.content;
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === 'text') {
        try { console.log(JSON.stringify(JSON.parse(c.text), null, 2)); }
        catch (_) { console.log(c.text); }
      }
    }
  } else {
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
