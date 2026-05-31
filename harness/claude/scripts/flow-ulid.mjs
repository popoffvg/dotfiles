#!/usr/bin/env node
// flow-ulid: print N ULIDs for tagging notable-if branches in workflow pseudocode.
// ULID = 48-bit millisecond timestamp + 80 bits randomness, Crockford base32 (26 chars).
// Usage: flow-ulid.mjs [count]   (default 1)

import { randomFillSync } from "node:crypto";

const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I, L, O, U)

function encodeTime(now, len) {
  let out = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    out = ENC[mod] + out;
    now = (now - mod) / 32;
  }
  return out;
}

function encodeRandom(len) {
  const bytes = randomFillSync(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += ENC[bytes[i] % 32];
  return out;
}

function ulid(now) {
  return encodeTime(now, 10) + encodeRandom(16);
}

const count = Math.max(1, Number(process.argv[2] || 1) | 0);
const now = Date.now();
const lines = [];
for (let i = 0; i < count; i++) lines.push(ulid(now));
process.stdout.write(lines.join("\n") + "\n");
