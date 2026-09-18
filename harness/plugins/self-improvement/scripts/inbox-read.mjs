#!/usr/bin/env node
// Print the inbox entries no session has shown yet. `inbox-read.mjs [--peek]`
//
// The reading half of the announcement path inbox-add.sh writes. The SessionStart
// hook runs this, so its output lands in the context of the session that starts
// next — which is the point: the scan that found a suggestion ran detached, with
// no session to speak into.
//
// Read position is a byte offset in inbox.read, not a flag on each entry. The
// writer only ever appends, so an offset that only ever moves forward can miss
// nothing and repeat nothing, and neither side has to take a lock. A file
// shorter than the offset means the inbox was reset behind us; start over.
//
// --peek renders without moving the offset, for a caller that is looking rather
// than announcing.
//
// Silence is the norm and never an error: no inbox, no node, a corrupt line, an
// unwritable mark — the entries are pointers to documents that stand on their
// own, so nothing here is worth failing a session start over.
import { openSync, readSync, closeSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const MAX_SHOWN = 10

const root = process.env.SELF_IMPROVE_ROOT || join(homedir(), '.claude', 'self-improvement')
const inboxPath = process.env.SELF_IMPROVE_INBOX || join(root, 'inbox.jsonl')
const markPath = process.env.SELF_IMPROVE_INBOX_MARK || join(root, 'inbox.read')
const peek = process.argv.includes('--peek')

const shorten = (p) => (p && p.startsWith(homedir()) ? '~' + p.slice(homedir().length) : p)

const readMark = () => {
  const parsed = Number.parseInt(readFileSync(markPath, 'utf8').trim(), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const readTail = (from, to) => {
  const fd = openSync(inboxPath, 'r')
  try {
    const buffer = Buffer.allocUnsafe(to - from)
    readSync(fd, buffer, 0, buffer.length, from)
    return buffer.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

const parseEntries = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)

const render = (entries, hidden) => {
  const count = entries.length + hidden
  const lines = [
    `Harness self-improvement — ${count} new since your last session:`,
    ...entries.map((e) => {
      const head = `- ${e.kind || 'entry'}: ${e.headline || e.session || ''}`.trimEnd()
      return e.path ? `${head} — ${shorten(e.path)}` : head
    }),
  ]
  if (hidden > 0) lines.push(`…and ${hidden} older, in ${shorten(inboxPath)}`)
  lines.push('Open a path to act on it, or run the self-improve TUI.')
  return lines.join('\n')
}

let size
try {
  size = statSync(inboxPath).size
} catch {
  process.exit(0)
}

let mark = 0
try {
  mark = readMark()
} catch {
  mark = 0
}
if (mark > size) mark = 0
if (mark === size) process.exit(0)

const entries = parseEntries(readTail(mark, size))

if (!peek) {
  try {
    writeFileSync(markPath, String(size))
  } catch {
    // An unread entry shown twice beats one never shown.
  }
}

if (entries.length === 0) process.exit(0)

const shown = entries.slice(-MAX_SHOWN)
process.stdout.write(render(shown, entries.length - shown.length) + '\n')
