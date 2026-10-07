export const meta = {
  name: 'wm-code-impl',
  description: 'Run the review gate chain until every gate passes — over one wm TODO it implements first, or over a diff no TODO pair covers',
  whenToUse: "Driving /code impl or /code review diff deterministically. In todo mode sonnet implements + commits first; in diff mode the code already exists and the chain starts at the gates. Then the review skill's chain — wm-rule-batches.py plans the rule batches, one parallel checks wave (lint, one haiku rule-checker per batch then the sonnet rule-reducer, idiom, reuse, and the opus correctness gate), then the sonnet test gate; each FAIL routes back to a wm:implementer fixup and restarts the checks (after a comment-only fixup, rules and the checks that failed; after a comment-and-rename fixup, lint, rules, and the checks that failed). wm-code-auto calls this once per TODO.",
  phases: [
    { title: 'Intent', detail: 'diff mode only — resolve the range and derive the intent sentence', model: 'haiku' },
    { title: 'Implement', detail: 'wm:implementer (sonnet, opus for a red TODO) writes + commits, and fixes every gate finding', model: 'sonnet' },
    { title: 'Plan', detail: 'before each wave — wm-rule-batches.py plan cuts the diff into rule-checker batches; exit 2 stops the run', model: 'haiku' },
    { title: 'Checks', detail: 'lint-tester + rule-checker per batch then rule-reducer + idiom-critic + reuse-critic + correctness-critic, in parallel', model: 'haiku + sonnet + opus' },
    { title: 'Judge', detail: 'from round 2, a red checks wave goes to an opus judge that waives it when every finding is a nit', model: 'opus' },
    { title: 'Test', detail: 'wm:tester (sonnet) gates the Autotest contract', model: 'sonnet' },
  ],
}

// ── args ─────────────────────────────────────────────────────────────────────
// todo mode: { todo: <N>, risk?: "red" | "yellow" | "green", notesDir?: ".notes", lessonsFile?, maxGateFails? }
// diff mode: { mode: "diff", range?: "HEAD", intent?, notesDir?, lessonsFile?, maxGateFails? }
//
// A slash invocation delivers args as TEXT, not as the object the caller wrote: real runs arrived
// as the bare string "TODO-2" and as the string '{"todo": 2}'. Reading `.todo` off a string yields
// undefined, so an unparsed args is indistinguishable from no args at all — which is how a run
// meant for TODO-2 silently became a gate pass over the last commit, implementing nothing. Parse
// every shape the caller can type, and let only a genuinely empty args reach the guard below.
function parseArgs(raw) {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'object') return raw
  if (typeof raw === 'number') return { todo: raw }
  const text = String(raw).trim()
  if (text === '') return {}
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch (err) {
      throw new Error(`args looks like JSON but does not parse: ${text} — ${err.message}`)
    }
  }
  const named = text.match(/^(?:TODO[-\s]?)?(\d+)$/i)
  if (named) return { todo: Number(named[1]) }
  // Anything else the caller typed is a revision the review:sub-diff.md table can resolve: a
  // branch, a sha, a range, a PR url, or the word "last".
  return { mode: 'diff', range: text }
}
const parsed = parseArgs(typeof args === 'undefined' ? null : args)

const notesDir = parsed.notesDir || '.notes'
const todo = parsed.todo
const hasTodo = todo !== undefined && todo !== null
// The caller states the mode, or names a todo. Defaulting a missing todo to diff mode makes the
// one mistake unrecoverable: a caller that meant todo mode and lost the arg gets a silent green
// gate run over whatever the last commit happened to be, with no implementation at all.
const mode = parsed.mode || (hasTodo ? 'todo' : null)
if (mode !== 'todo' && mode !== 'diff') {
  throw new Error('Name the work: { todo: <N> } to implement one TODO and gate it, or { mode: "diff", range } to gate code that already exists.')
}
if (mode === 'todo' && !hasTodo) {
  throw new Error('todo mode needs args { todo: <N> } — which TODO to implement. Pass { mode: "diff" } to gate a diff instead.')
}
const todoPath = mode === 'todo' ? `${notesDir}/todos/TODO-${todo}.md` : null

// review:sub-diff.md step 1 — the caller names the range; nothing named means the working tree.
// In todo mode a missing range is resolved by the first Plan step: the TODO's commit plus its fixups.
let range = parsed.range || (mode === 'todo' ? null : 'worktree')
let intent = parsed.intent || null

// Set by wm-code-auto to the lessons file every round must read before it edits.
const lessonsFile = parsed.lessonsFile || null

// null = unbounded-until-green, the standalone `/code impl` contract. wm-code-auto
// passes 3 — sub-auto.md's "three failed rounds on one gate → status: blocked".
const maxGateFails = parsed.maxGateFails || null

const implementerModel = parsed.risk === 'red' ? 'opus' : 'sonnet'

// Backstop only, for the unbounded case: real termination is a gate budget or the
// implementer's own hard-stop returning status:"blocked". Logged if ever hit
// (never a silent truncation).
const MAX_ROUNDS = 20

// ── schemas ──────────────────────────────────────────────────────────────────
const GATE = {
  type: 'object',
  additionalProperties: false,
  required: ['result'],
  properties: {
    result: { enum: ['PASS', 'FAIL'] },
    failures: { type: 'array', items: { type: 'string' }, description: 'file:line — concrete failure — the edit that closes it' },
    ran: { type: 'string', description: 'the real commands run + their output summary' },
    wroteTests: { type: 'array', items: { type: 'string' }, description: 'test files this gate wrote itself and left uncommitted' },
  },
}
const IMPL = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: { type: 'string', description: 'what shipped + the commit sha' },
    blocker: { type: 'string', description: 'set only when blocked: what was tried + why stopped' },
    commentOnly: { type: 'boolean', description: 'correction round only: true when every line the fixup changes is a comment or a doc tag and no code token changed, checked with git show on the fixup' },
    renameOnly: { type: 'boolean', description: 'correction round only: true when every changed code line differs from its old line only in identifiers the failures asked to rename, checked with git show on the fixup; comments may change too' },
  },
}
const PLAN = {
  type: 'object',
  additionalProperties: false,
  required: ['exit', 'range', 'summary', 'batches', 'stderr'],
  properties: {
    exit: { type: 'integer', description: 'the exit code of wm-rule-batches.py plan' },
    range: { type: 'string', description: 'the --range value passed, verbatim' },
    summary: { type: 'string', description: 'its one stdout line, verbatim' },
    batches: { type: 'integer', description: 'the batch count that line names' },
    stderr: { type: 'string', description: 'its stderr, verbatim; empty when none' },
  },
}
const INTENT = {
  type: 'object',
  additionalProperties: false,
  required: ['range', 'intent', 'empty'],
  properties: {
    range: { type: 'string', description: 'the resolved revision range, verbatim' },
    intent: { type: 'string', description: 'one sentence: what this change is for' },
    empty: { type: 'boolean', description: 'true when the range holds no change' },
  },
}

const JUDGE = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'blocking'],
  properties: {
    verdict: { enum: ['ALLOW', 'BLOCK'] },
    blocking: { type: 'array', items: { type: 'string' }, description: 'the findings verbatim that are not nits; empty on ALLOW' },
    reason: { type: 'string', description: 'one line per finding: nit or blocking, and why' },
  },
}

// A checks wave still red on this round goes to the judge instead of straight to another fixup.
const JUDGE_FROM_ROUND = 2

// ── the subject of every prompt ──────────────────────────────────────────────
const PLUGIN = '${CLAUDE_PLUGIN_ROOT}'
// Two entries are obeyed for different reasons. A CODE lesson is about the files this TODO edits,
// so it applies only when the Files overlap. An ENVIRONMENT lesson — which runtime, which command
// runner, how the suite is invoked — applies to EVERY TODO regardless of Files, because it is about
// the machine, not the change. Scoping both by Files hides the environment ones from every round
// that needs them, which is how a known "use the pinned Node" lesson still let a TODO fail three
// rounds on that exact Node.
const lessonsClause =
  `Read ${notesDir}/GOTCHAS.md when it exists and obey every entry — the traps earlier TODOs already met. ` +
  (lessonsFile
  ? `FIRST read ${lessonsFile} in full — every round, before any command or edit. Obey every entry ` +
    `whose Files overlap this TODO's Files, AND every entry about the environment or toolchain ` +
    `(which runtime or version to use, which command runner wraps it, how to invoke the suite or ` +
    `the linter) — those apply to every TODO whatever its Files say. `
  : '')

// Nobody is watching this run, so the blast radius of a "just bootstrap it" reflex is unbounded.
// A setup task is written for a fresh machine: it provisions credentials and writes to stores that
// are global to the user, not scoped to this checkout or worktree. One such command regenerated a
// keychain vault password and made an encrypted file unreadable for every checkout on the machine,
// with the old password unrecoverable. A missing environment is a BLOCKER to report, never a thing
// to install.
const safetyClause =
  `SAFETY, because this run is unattended: never run a project bootstrap, setup, provisioning or ` +
  `credential command — anything like "<runner> run setup", "make setup", a bootstrap/install script, ` +
  `or a command that writes a keychain, credential store, dotenv or secret, or that generates or ` +
  `rotates a key. These are global to the machine and destroy state other checkouts depend on, often ` +
  `irreversibly. If a command fails because the environment is missing something, return ` +
  `status:"blocked" naming exactly what is missing and the command you would have needed — let a ` +
  `human install it. Never put a secret value in anything you return. `

// The rules, idiom, and reuse gates judge a diff, and a wm diff carries two kinds of file:
// source, and the notes corpus the source was written from. Only source is the subject. Left
// unsaid, the gates judge the spec: a real run spent findings on the identifiers quoted inside
// `todos/TODO-5.md` and on the em-dashes in its Outcome paragraph, and the implementer edited the
// approved spec to close them — the one file a gate round must never touch.
const scopeClause =
  `SCOPE: judge SOURCE files only. Everything under ${notesDir}/ — the spec, the TODO pair, the ` +
  `glossary, the thought notes — is the INPUT you judge against, never the subject you judge. ` +
  `Report no finding whose file lives there, and propose no edit to one. A problem you see in the ` +
  `spec itself is a spec bug for a human, not a gate finding: leave it out. `

// Diff mode has no TODO to implement, so a correction round is a correction and nothing more: fix
// exactly what the gate reported and add no behaviour, because no pair approved any.
function implPrompt(failures, extra) {
  const base =
    lessonsClause +
    safetyClause +
    (mode === 'todo'
      ? `Implement exactly one TODO: ${todoPath} (notes-dir ${notesDir}). ` +
        `Follow ${PLUGIN}/skills/impl/commands/sub-impl.md steps 1-4, 6, 7 (read context, dependency gate, ` +
        `replan guard, every increment in order, glossary, autotest) as if the resolved approve key were ` +
        `"none": the increment review (step 5.2), the show + approval loop (steps 5.3-5.4), and the TODO review do not run — ` +
        `nobody is watching, and this workflow runs the gate chain itself once the TODO is committed. ` +
        `Both ## Autotest commands green before committing. `
      : `Correct the code already in ${range} (notes-dir ${notesDir}) — no TODO pair covers it, its ` +
        `intent is: ${intent}. Close the findings below and change nothing else: add no behaviour, ` +
        `widen no scope. Leave the tests that cover the changed files green. `) +
    `Commit per ${PLUGIN}/skills/impl/commands/sub-commit.md. ` +
    `Return status:"done" once green + committed, or status:"blocked" with the blocker if you hit a hard-stop ` +
    `(3+ edits without green, 2 failed fix attempts, tool/permission error, or a request to replan).`
  if (extra) return `${base}\n\n${extra}`
  if (!failures || failures.length === 0) return base
  return (
    `${base}\n\nCORRECTION round — a gate failed. Address these failures, then commit a FIXUP ` +
    `(git commit --fixup=<sha-being-corrected>), never a plain commit:\n` +
    failures.map((f) => `- ${f}`).join('\n') +
    `\n\nSet commentOnly:true only when git show on your fixup changes comments and doc tags and nothing else. ` +
    `Set renameOnly:true only when every code line it changes differs from the old line only in identifiers the failures asked to rename.`
  )
}

// The gate roster: ${CLAUDE_PLUGIN_ROOT}/skills/review/references/ref-gates.md owns which gate
// judges what and at which tier. checks() runs as one parallel wave; serial() runs in order after it.
// Every gate carries the lessons clause: the gates are the agents that actually RUN the linter and
// the suite, so an environment lesson that reaches only the implementer cannot change the command
// that fails.
//
// Both rosters are functions, not constants, because in diff mode the subject of every brief — the
// resolved range and the intent sentence — is only known after the Intent agent returns. Building
// the briefs up front is what sent every gate the literal string "null" as the thing to judge.
function subjectClause() {
  if (mode === 'todo') return `${todoPath} (notes-dir ${notesDir})`
  return `the diff ${range} (notes-dir ${notesDir}) — no TODO pair covers it. Intent: ${intent}`
}

// A row with `batches` is a map-reduce gate: one `mapAgentType` agent per batch, then the row's own
// agent over their results. A row with `verdictFromText` runs with no schema; its verdict is the
// `Result:` line of the text it returns.
function checks(batches) {
  const subject = subjectClause()
  const theDiff = mode === 'todo' ? `the diff ${range} of ${subject} — the TODO's commit plus its fixups` : subject
  return [
    {
      key: 'lint',
      agentType: 'wm:lint-tester',
      model: 'haiku',
      prompt:
        lessonsClause +
        safetyClause +
        `Lint gate for ${subject}. Follow the wm:lint-tester contract: lint the changed files with ` +
        `the repo's configured linter and run the tests covering them. ` +
        (mode === 'todo'
          ? `Take the file list from the diff ${range} + the TODO's Files, and run the TODO's Autotest too. `
          : `Take the file list from the diff; no ## Autotest command exists, so the covering tests are all you run. `) +
        `Return result PASS/FAIL, failures verbatim, and the real commands you ran.`,
    },
    {
      key: 'rules',
      agentType: 'wm:rule-reducer',
      model: 'sonnet',
      mapAgentType: 'wm:rule-checker',
      mapModel: 'haiku',
      batches,
      verdictFromText: true,
      prompt:
        `rules: ${reportDir}/rules\nreport: ${reportDir}/rules.md` +
        settledRenames.map((s) => `\nsettled: ${s.from} → ${s.to}`).join(''),
    },
    {
      key: 'idiom',
      agentType: 'wm:idiom-critic',
      model: 'sonnet',
      prompt:
        lessonsClause +
        scopeClause +
        `Idiom gate for ${theDiff}. Follow the wm:idiom-critic contract. Return result PASS/FAIL with ` +
        `failures (file:line — the idiom broken — the guide — the rewrite).`,
    },
    {
      key: 'reuse',
      agentType: 'wm:reuse-critic',
      model: 'sonnet',
      prompt:
        lessonsClause +
        scopeClause +
        `Reuse gate for ${theDiff}. Follow the wm:reuse-critic contract; the reuse contract is ${notesDir}/PATTERNS.md. ` +
        `Return result PASS/FAIL with failures (file:line — the job — the existing symbol at its file:line — the rewrite onto it).`,
    },
    {
      key: 'correctness',
      agentType: 'wm:correctness-critic',
      model: 'opus',
      prompt:
        lessonsClause +
        safetyClause +
        scopeClause +
        `Correctness gate for ${theDiff}. Follow the wm:correctness-critic contract.\n` +
        `range: ${range}\n` +
        `toolchain: ${reportDir}/toolchain.json\n` +
        (mode === 'diff' ? `intent: ${intent} — context, never a contract.\n` : '') +
        `Return result PASS/FAIL with failures (file:line — scenario — closing edit).`,
    },
  ]
}

function serial() {
  const subject = subjectClause()
  return [
    {
      key: 'test',
      phase: 'Test',
      agentType: 'wm:tester',
      prompt:
        lessonsClause +
        safetyClause +
        `Test gate for ${subject}. The checks wave is green — the one question left: ` +
        (mode === 'todo'
          ? `does a test actually assert this TODO's ## Autotest contract (both Unit and E2E)? ` +
            `No test covers it → WRITE that test first, then run it, and list every file you wrote ` +
            `in wroteTests (you do not commit — the implementer folds them in). ` +
            `Return result FAIL on a red run or a contract you cannot cover, with the real commands ` +
            `and the failures verbatim; PASS when the contract is covered and green.`
          : `does a test assert the behaviour this diff changed? Run the tests that cover it. ` +
            `Return result FAIL on a red run or an uncovered change, naming the gap with the real ` +
            `commands and the failures verbatim; PASS when the changed behaviour is covered and green.`),
    },
  ]
}

// Every gate got a byte-identical brief in every round, so each round was a cold re-read with no
// knowledge that it had already cleared the text in front of it. Measured on one TODO: a gate
// passed rounds 2 and 3 and then failed round 4 on spec lines no fixup had touched, and another
// passed a test three times before demanding its deletion. Each such late finding
// costs a full implementer round. Handing a gate its own record turns "I could raise this" into
// "I already passed this", and asks for the rest of its findings now instead of next round.
// Every gate contract hard-requires the `report:` path its brief names, and no brief named one:
// four of the five wrote to a path they guessed, and one invented a different path from its
// siblings, so the run left no readable record where the next run looks for it.
const reportDir = mode === 'todo' ? `${notesDir}/review/TODO-${todo}` : `${notesDir}/review/diff`

// Renames a fixup already applied. From round 2 the rule-reducer drops a FAIL that asks for one again.
const settledRenames = []

// Planned every round: the rule dirs are read again, so a rule added mid-chain is checked next round.
async function planRules() {
  phase('Plan')
  const rangeStep =
    range === null
      ? `First resolve the range: the TODO-${todo} commit plus every fixup on top of it — ` +
        `<parent of the TODO's commit>..HEAD, found with git log --oneline. Use it as <range>.\n`
      : ''
  const out = await agent(
    `Plan the rule-checker batches. Change no other file, commit nothing.\n` +
      rangeStep +
      `Run exactly:\n` +
      `~/.claude/scripts/wm-rule-batches.py plan --notes-dir ${notesDir}` +
      (mode === 'todo' ? ` --todo TODO-${todo}` : '') +
      ` --range ${range === null ? '<range>' : range} --out ${reportDir}/rules\n` +
      `Return its exit code, the --range value you passed, its one stdout line, the batch count in that line, and its stderr.`,
    { agentType: 'general-purpose', model: 'haiku', phase: 'Plan', schema: PLAN, label: `plan:r${round}` },
  )
  if (!out) return { error: 'the plan agent died' }
  if (out.exit !== 0) return { error: `wm-rule-batches.py plan exited ${out.exit}: ${out.stderr.trim()}` }
  if (range === null) range = out.range
  log(`round ${round}: ${out.summary}`)
  const batches = Array.from({ length: out.batches }, (_, i) => {
    const id = `b${String(i + 1).padStart(3, '0')}`
    return { id, brief: `${reportDir}/rules/batches/${id}.md` }
  })
  return { batches }
}

// The `Result:` line decides the verdict; each `- ` line under `## Failures` is one failure.
function verdictFromText(text) {
  const result = (text.match(/Result:\s*(PASS|FAIL)/) || [])[1]
  if (!result) return null
  const section = (text.split(/^## Failures.*$/m)[1] || '').split(/^## /m)[0]
  const failures = section.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim())
  return { result, failures }
}

async function runGate(gate) {
  const opts = { agentType: gate.agentType, model: gate.model, phase: 'Checks', label: `${gate.key}:r${round}` }
  if (gate.batches) {
    const mapped = await parallel(
      gate.batches.map((b) => () =>
        agent(`batch: ${b.brief}`, { agentType: gate.mapAgentType, model: gate.mapModel, phase: 'Checks', label: `${gate.key}:${b.id}:r${round}` }),
      ),
    )
    const lost = gate.batches.filter((_, i) => !mapped[i])
    if (lost.length > 0) log(`round ${round}: ${lost.length} ${gate.mapAgentType} agent(s) died — the reducer reports their pairs as UNCHECKED`)
  }
  if (gate.verdictFromText) {
    const text = await agent(gate.prompt + historyClause(gate.key), opts)
    return text ? verdictFromText(text) : null
  }
  return agent(gate.prompt + reportClause(gate.key) + historyClause(gate.key), { ...opts, schema: GATE })
}

function reportClause(gateKey) {
  return ` report: ${reportDir}/${gateKey}.md`
}

function historyClause(gateKey) {
  const mine = history.filter((h) => h.gate === gateKey)
  if (mine.length === 0) return ''
  const record = mine
    .map((h) => `- round ${h.round}: ${h.result}` + (h.failures.length > 0 ? `\n` + h.failures.map((f) => `    - ${f}`).join('\n') : ''))
    .join('\n')
  return (
    `\n\nYOUR OWN RECORD. This is round ${round} of the same chain over the same work, and you have ` +
    `judged it before:\n${record}\n\n` +
    `A finding you could have raised in an earlier round, on text no fixup has touched since, is ` +
    `OUT OF ORDER — you read that text and you passed it. Raise it only if it changed since; say ` +
    `what changed. Everything else you still have: raise it NOW, in this round, because a finding ` +
    `kept back costs a whole implementation round. Re-report a finding above only when the fixup ` +
    `failed to close it, and name which one it repeats.`
  )
}

// Two rule sources flip a name back and forth forever, and neither can see the other: one judged an
// identifier from a smell table while another enforced the rule that fixes that same identifier's
// spelling. Measured: four rounds, the same rename applied in both directions twice, and `git diff` between the two fixups EMPTY — 25 minutes
// and 155k output tokens of pure churn. A reversal is not a finding to route; it is a contradiction
// between two rules only a human can settle.
// Only the TARGET of a finding is stated precisely — after the `→`, or after "rename … to X". The
// subject is prose ("every desktop occurrence"), so pairing the target against every identifier in
// the finding is what actually reads both shapes. That over-generates on purpose: a pair matters
// only when its exact reverse turns up in another round, and noise has no reverse.
function renamePairs(text) {
  const ident = /[A-Za-z_][A-Za-z0-9_]{2,}/g
  // A finding is mostly prose, and prose words pair up as readily as names do. An internal case
  // change, an underscore or a digit is what separates `pickedIdP` from `qualifier` — without this
  // the pairs are built out of English and a reversal can be spelled by two ordinary sentences.
  const isCodeName = (s) => /[a-z][A-Z]|_|\d/.test(s)
  const mentioned = (text.match(ident) || []).filter(isCodeName)
  const targets = new Set()
  const arms = text.split('→')
  if (arms.length >= 2) for (const t of (arms[arms.length - 1].match(ident) || []).filter(isCodeName)) targets.add(t)
  for (const m of text.matchAll(/(?:[Rr]ename|[Rr]espell|[Cc]all it)[^.;\n]*?\s(?:to|into|as)\s+([A-Za-z_][A-Za-z0-9_]{2,})/g)) {
    if (isCodeName(m[1])) targets.add(m[1])
  }
  const pairs = []
  for (const target of targets) for (const subject of mentioned) if (subject !== target) pairs.push([subject, target])
  return pairs
}

// A single pair is noise — the arrow split over-generates. A pair whose EXACT reverse was proposed
// in an earlier round is not: that is the loop undoing itself.
function oscillation() {
  const seen = []
  for (const h of history) {
    for (const finding of h.failures) {
      for (const [from, to] of renamePairs(finding)) {
        const back = seen.find((s) => s.from === to && s.to === from && s.round !== h.round)
        if (back) return { first: back, second: { round: h.round, gate: h.gate, finding, from, to } }
        seen.push({ round: h.round, gate: h.gate, finding, from, to })
      }
    }
  }
  return null
}

// A late round fails mostly on taste: a clearer name, a shorter comment, a test that is only
// redundant. Each costs a full implementer round and moves no behaviour. The judge lets the chain
// go on when nothing but nits is left, and names the findings that still block when something is.
function judgePrompt(findings) {
  return (
    lessonsClause +
    scopeClause +
    `Triage judge for ${subjectClause()}, round ${round}. The checks wave is red again. Read the ` +
    `real diff and each finding below, and classify every finding:\n` +
    `- BLOCKING: a correctness bug, a lint or test failure, spec drift, a broken rule that is not ` +
    `Severity: nit, a broken D<NNN> rule, an UNCHECKED rule, a name or comment that states something ` +
    `false, a test that asserts nothing.\n` +
    `- NIT: a style preference, a clearer name for a name that is not wrong, wording, ordering, a ` +
    `redundant but harmless test, anything whose fix changes no behaviour and hides no bug.\n` +
    `When you are not sure, it is BLOCKING. Return verdict ALLOW only when every finding is a NIT; ` +
    `otherwise BLOCK with the blocking findings verbatim. Change no file, commit nothing.\n\n` +
    `Findings:\n` +
    findings.map((f) => `- ${f}`).join('\n')
  )
}

// ── loop ─────────────────────────────────────────────────────────────────────
let round = 0
let foldedTests = false
let rerunOnly = null
const history = []
const fails = { lint: 0, rules: 0, idiom: 0, reuse: 0, correctness: 0, test: 0 }

function blocked(stage, impl) {
  return { result: 'BLOCKED', mode, todo, stage, blocker: impl ? impl.blocker : 'implementer agent died', round, history }
}

let impl = null
if (mode === 'todo') {
  phase('Implement')
  impl = await agent(implPrompt(), { agentType: 'wm:implementer', model: implementerModel, phase: 'Implement', schema: IMPL, label: `impl:TODO-${todo}` })
  if (!impl || impl.status === 'blocked') return blocked('initial', impl)
} else {
  // review:sub-diff.md steps 1-2 — resolve the range and derive the intent, because the
  // correctness gate has nothing approved to judge against without them.
  phase('Intent')
  const resolved = await agent(
    `Resolve a review target and report it. Change no file, commit nothing.\n` +
      `1. Resolve "${range}" into one revision range per review:sub-diff.md step 1 — "worktree" means the ` +
      `uncommitted working tree — return the word worktree as the range, "last" means HEAD~1..HEAD, a branch means that branch against ` +
      `its merge base with the default branch, a sha or range means exactly that, a PR url or number means gh pr diff.\n` +
      `2. Set empty:true when that range holds no change.\n` +
      (intent
        ? `3. The intent is already given — return it verbatim: ${intent}\n`
        : `3. Derive the intent: one sentence saying what this change is for, from the commit messages in the range.\n`),
    { agentType: 'general-purpose', model: 'haiku', phase: 'Intent', schema: INTENT, label: 'intent' },
  )
  if (!resolved) return { result: 'ERROR', mode, stage: 'intent', round, history }
  if (resolved.empty) {
    log(`range ${resolved.range} is empty — reporting it as empty, never as a green run`)
    return { result: 'EMPTY', mode, range: resolved.range, round, history }
  }
  // The gates judge the range the Intent agent resolved, not the shorthand the caller typed.
  range = resolved.range
  intent = resolved.intent
  log(`range ${resolved.range} — intent: ${intent}`)
}

while (round < MAX_ROUNDS) {
  round++
  let failed = null
  let uncommitted = null
  const testsOnly = foldedTests
  foldedTests = false
  const onlyKeys = rerunOnly
  rerunOnly = null

  // The checks: the gates over the same diff, in one parallel batch. They share no state, so the
  // wall clock is the slowest of them instead of their sum.
  const plan = await planRules()
  if (plan.error) {
    log(`round ${round}: rule plan failed — ${plan.error}`)
    return { result: 'ERROR', mode, todo, stage: 'rules-plan', blocker: plan.error, round, history }
  }
  phase('Checks')
  const CHECKS = testsOnly
    ? checks(plan.batches).filter((g) => g.key === 'rules')
    : onlyKeys
      ? checks(plan.batches).filter((g) => onlyKeys.has(g.key))
      : checks(plan.batches)
  const checksOut = await parallel(CHECKS.map((gate) => () => runGate(gate).then((out) => ({ gate, out }))))
  const checksRuns = checksOut.filter(Boolean)
  const checksDied = CHECKS.filter((g) => !checksRuns.some((r) => r.gate.key === g.key) || !checksRuns.find((r) => r.gate.key === g.key).out)
  if (checksDied.length > 0) return { result: 'ERROR', mode, todo, stage: checksDied.map((g) => g.key).join('+'), round, history }
  for (const { gate, out } of checksRuns) history.push({ round, gate: gate.key, result: out.result, failures: out.failures || [], ran: out.ran || '' })

  // One fixup carries every failing check's findings — separate fixups would each invalidate the
  // next gate's read of the diff.
  let checksFails = checksRuns.filter(({ out }) => out.result === 'FAIL')
  if (checksFails.length > 0 && round >= JUDGE_FROM_ROUND) {
    const findings = checksFails.flatMap(({ gate, out }) => (out.failures || []).map((f) => `[${gate.key}] ${f}`))
    phase('Judge')
    const ruling = await agent(judgePrompt(findings) + reportClause('judge'), {
      agentType: 'general-purpose',
      model: 'opus',
      phase: 'Judge',
      schema: JUDGE,
      label: `judge:r${round}`,
    })
    if (!ruling) return { result: 'ERROR', mode, todo, stage: 'judge', round, history }
    history.push({ round, gate: 'judge', result: ruling.verdict, failures: ruling.blocking || [], waived: ruling.verdict === 'ALLOW' ? findings : [], ran: ruling.reason || '' })
    if (ruling.verdict === 'ALLOW') {
      log(`round ${round}: judge waived ${findings.length} nit(s) from ${checksFails.map(({ gate }) => gate.key).join('+')} → checks count as green`)
      checksFails = []
    }
  }
  if (checksFails.length > 0) {
    failed = {
      gate: { key: checksFails.map(({ gate }) => gate.key).join('+') },
      out: { failures: checksFails.flatMap(({ gate, out }) => (out.failures || []).map((f) => `[${gate.key}] ${f}`)) },
    }
    for (const { gate } of checksFails) fails[gate.key] += 1
  }

  // The serial gates, in order, only once the checks are green. The tester already ran the tests it
  // wrote, so the round that judges them skips it.
  if (!failed && !testsOnly) {
    for (const gate of serial()) {
      phase(gate.phase)
      const out = await agent(gate.prompt + reportClause(gate.key) + historyClause(gate.key), {
        agentType: gate.agentType,
        phase: gate.phase,
        schema: GATE,
        label: `${gate.key}:r${round}`,
      })
      if (!out) return { result: 'ERROR', mode, todo, stage: gate.key, round, history }
      history.push({ round, gate: gate.key, result: out.result, failures: out.failures || [], ran: out.ran || '' })
      if (out.result === 'FAIL') {
        failed = { gate, out }
        fails[gate.key] += 1
        break
      }
      // A gate that wrote a test left it uncommitted — fold it in, then run the chain again.
      if ((out.wroteTests || []).length > 0) {
        uncommitted = { gate, out }
        break
      }
    }
  }

  if (!failed && !uncommitted) {
    log(`${mode === 'todo' ? `TODO-${todo}` : range} green on every gate after ${round} round(s)`)
    return { result: 'PASS', mode, todo, range: mode === 'diff' ? range : undefined, intent, round, summary: impl ? impl.summary : undefined, waived: history.flatMap((h) => h.waived || []), history }
  }

  if (uncommitted) {
    const files = uncommitted.out.wroteTests
    log(`round ${round}: ${uncommitted.gate.key} gate wrote ${files.length} test file(s) → implementer folds them in`)
    phase('Implement')
    impl = await agent(
      implPrompt(null, `The ${uncommitted.gate.key} gate wrote these test files and left them uncommitted:\n` +
        files.map((f) => `- ${f}`).join('\n') +
        `\nFold them into the commit under review (git commit --amend, or a fixup if the commit was already corrected once). Change nothing else.`),
      { agentType: 'wm:implementer', model: implementerModel, phase: 'Implement', schema: IMPL, label: `commit-tests:r${round}` },
    )
    if (!impl || impl.status === 'blocked') return blocked('commit-tests', impl)
    foldedTests = true
    continue
  }

  // Before spending another implementation round: is this round undoing an earlier one? A reversal
  // means two gates disagree on a rule, and no number of further rounds can settle that — each one
  // just applies the rename the other will flip back.
  const flip = oscillation()
  if (flip) {
    log(
      `round ${round}: OSCILLATION — ${flip.first.gate} (round ${flip.first.round}) wants ` +
        `${flip.first.from} → ${flip.first.to}, ${flip.second.gate} (round ${flip.second.round}) wants it back. Stopping.`,
    )
    return {
      result: 'BLOCKED',
      mode,
      todo,
      stage: `oscillation:${flip.first.gate}-vs-${flip.second.gate}`,
      blocker:
        `Two gates are reversing each other on ${flip.first.from} / ${flip.first.to}, so every ` +
        `further round is churn. A human decides which rule wins.\n` +
        `- ${flip.first.gate} (round ${flip.first.round}): ${flip.first.finding}\n` +
        `- ${flip.second.gate} (round ${flip.second.round}): ${flip.second.finding}`,
      round,
      history,
    }
  }

  // The budget is per gate, so a checks FAIL is measured against the worst of the gates that failed.
  const failures = failed.out.failures || []
  const spent = Math.max(...failed.gate.key.split('+').map((k) => fails[k]))
  log(`round ${round}: ${failed.gate.key.toUpperCase()} FAIL (${failures.length} findings, ${spent}/${maxGateFails || '∞'}) → implementer fixup`)

  if (maxGateFails && spent >= maxGateFails) {
    return {
      result: 'BLOCKED',
      mode,
      todo,
      stage: failed.gate.key,
      blocker: `${failed.gate.key} gate failed ${spent} rounds; last findings: ${failures.join(' | ') || '(none reported)'}`,
      round,
      history,
    }
  }

  phase('Implement')
  impl = await agent(implPrompt(failures), { agentType: 'wm:implementer', model: implementerModel, phase: 'Implement', schema: IMPL, label: `fixup-${failed.gate.key}:r${round}` })
  if (!impl || impl.status === 'blocked') return blocked(`${failed.gate.key}-fixup`, impl)
  for (const f of failures) {
    for (const m of f.matchAll(/`?([A-Za-z_][A-Za-z0-9_]{2,})`?\s*→\s*`?([A-Za-z_][A-Za-z0-9_]{2,})`?/g)) {
      if (!settledRenames.some((r) => r.from === m[1] && r.to === m[2])) settledRenames.push({ from: m[1], to: m[2] })
    }
  }
  // A fixup can break what an earlier gate already cleared → restart the chain, never resume.
  // A comment-only fixup cannot, so only the rules gate and the gates that failed run again.
  // A rename changes no behaviour, so correctness keeps its verdict; lint still runs because a
  // missed call site fails the build.
  if (impl.commentOnly) {
    rerunOnly = new Set(['rules', ...failed.gate.key.split('+')])
    log(`round ${round}: fixup changed comments only → next checks: ${[...rerunOnly].join('+')}`)
  } else if (impl.renameOnly) {
    rerunOnly = new Set(['lint', 'rules', ...failed.gate.key.split('+')])
    log(`round ${round}: fixup changed comments and renames only → next checks: ${[...rerunOnly].join('+')}`)
  }
}

log(`${mode === 'todo' ? `TODO-${todo}` : range}: hit MAX_ROUNDS=${MAX_ROUNDS} without every gate green — stopping (backstop, not a silent truncation)`)
return { result: 'MAX_ROUNDS', mode, todo, round, history }
