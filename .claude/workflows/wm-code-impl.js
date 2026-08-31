export const meta = {
  name: 'wm-code-impl',
  description: 'Run the review gate chain until every gate passes — over one wm TODO it implements first, or over a diff no TODO pair covers',
  whenToUse: "Driving /code impl or /code review diff deterministically. In todo mode sonnet implements + commits first; in diff mode the code already exists and the chain starts at the gates. Then the review skill's chain — one parallel checks batch (lint, comments, names, and the opus outcome gate), then the sonnet test gate; each FAIL routes back to a wm:implementer fixup and restarts the checks. wm-code-auto calls this once per TODO.",
  phases: [
    { title: 'Intent', detail: 'diff mode only — resolve the range and derive the intent sentence', model: 'haiku' },
    { title: 'Implement', detail: 'wm:implementer (sonnet) writes + commits, and fixes every gate finding', model: 'sonnet' },
    { title: 'Checks', detail: 'lint-tester + comment-critic + name-critic + reviewer, in parallel', model: 'haiku + opus' },
    { title: 'Test', detail: 'wm:tester (sonnet) gates the Autotest contract', model: 'sonnet' },
  ],
}

// ── args ─────────────────────────────────────────────────────────────────────
// todo mode: { todo: <N>, notesDir?: ".notes", lessonsFile?, maxGateFails? }
// diff mode: { mode: "diff", range?: "HEAD", intent?, notesDir?, lessonsFile?, maxGateFails? }
const notesDir = (args && args.notesDir) || '.notes'
const todo = args && args.todo
const mode = (args && args.mode) || (todo === undefined || todo === null ? 'diff' : 'todo')
if (mode === 'todo' && (todo === undefined || todo === null)) {
  throw new Error('todo mode needs args { todo: <N> } — which TODO to implement. Pass { mode: "diff" } to gate a diff instead.')
}
const todoPath = mode === 'todo' ? `${notesDir}/todos/TODO-${todo}.md` : null

// review:sub-diff.md step 1 — the caller names the range; nothing named means the working tree.
const range = (args && args.range) || 'HEAD'
let intent = (args && args.intent) || null

// Set by wm-code-auto to the lessons file every round must read before it edits.
const lessonsFile = (args && args.lessonsFile) || null

// null = unbounded-until-green, the standalone `/code impl` contract. wm-code-auto
// passes 3 — sub-auto.md's "three failed rounds on one gate → status: blocked".
const maxGateFails = (args && args.maxGateFails) || null

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

// ── the subject of every prompt ──────────────────────────────────────────────
const PLUGIN = '${CLAUDE_PLUGIN_ROOT}'
// Two entries are obeyed for different reasons. A CODE lesson is about the files this TODO edits,
// so it applies only when the Files overlap. An ENVIRONMENT lesson — which runtime, which command
// runner, how the suite is invoked — applies to EVERY TODO regardless of Files, because it is about
// the machine, not the change. Scoping both by Files hides the environment ones from every round
// that needs them, which is how a known "use the pinned Node" lesson still let a TODO fail three
// rounds on that exact Node.
const lessonsClause = lessonsFile
  ? `FIRST read ${lessonsFile} in full — every round, before any command or edit. Obey every entry ` +
    `whose Files overlap this TODO's Files, AND every entry about the environment or toolchain ` +
    `(which runtime or version to use, which command runner wraps it, how to invoke the suite or ` +
    `the linter) — those apply to every TODO whatever its Files say. `
  : ''

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

function implPrompt(failures, extra) {
  const base =
    lessonsClause +
    safetyClause +
    `Implement exactly one TODO: ${todoPath} (notes-dir ${notesDir}). ` +
    `Follow ${PLUGIN}/skills/impl/commands/sub-impl.md steps 1-4, 6, 7 (read context, dependency gate, ` +
    `replan guard, every increment in order, glossary, autotest) with one change: the per-increment ` +
    `approval loop (step 5.3) does not run — nobody is watching, so apply each increment without asking. ` +
    `Both ## Autotest commands green before committing. Commit per ${PLUGIN}/skills/impl/commands/sub-commit.md. ` +
    `Return status:"done" once green + committed, or status:"blocked" with the blocker if you hit a hard-stop ` +
    `(3+ edits without green, 2 failed fix attempts, tool/permission error, or a request to replan).`
  if (extra) return `${base}\n\n${extra}`
  if (!failures || failures.length === 0) return base
  return (
    `${base}\n\nCORRECTION round — a gate failed. Address these failures, then commit a FIXUP ` +
    `(git commit --fixup=<sha-being-corrected>), never a plain commit:\n` +
    failures.map((f) => `- ${f}`).join('\n')
  )
}

// The gate roster: ${CLAUDE_PLUGIN_ROOT}/skills/review/references/ref-gates.md owns which gate
// judges what and at which tier. WAVE runs as one parallel wave; SERIAL runs in order after it.
// Every gate carries the lessons clause: the gates are the agents that actually RUN the linter and
// the suite, so an environment lesson that reaches only the implementer cannot change the command
// that fails.
const WAVE = [
  {
    key: 'lint',
    agentType: 'wm:lint-tester',
    prompt:
      lessonsClause +
      safetyClause +
      `Lint gate for ${todoPath} (notes-dir ${notesDir}). Follow the wm:lint-tester contract: ` +
      `from the diff + the TODO's Files, lint the changed files with the repo's configured linter, ` +
      `run the TODO's Autotest and the tests covering the changed files. Return result PASS/FAIL, ` +
      `failures verbatim, and the real commands you ran.`,
  },
  {
    key: 'comment',
    agentType: 'wm:comment-critic',
    prompt:
      lessonsClause +
      safetyClause +
      `Comment gate for the diff of ${todoPath} (notes-dir ${notesDir}) — the TODO's commit plus its ` +
      `fixups. Follow the wm:comment-critic contract: judge every comment, doc line, and doc tag the ` +
      `diff adds or changes. You never read the TODO pair — a comment is judged against the code ` +
      `under it. Return result PASS/FAIL with failures (file:line — the rule — the rewrite).`,
  },
  {
    key: 'name',
    agentType: 'wm:name-critic',
    prompt:
      lessonsClause +
      safetyClause +
      `Naming gate for the diff of ${todoPath} (notes-dir ${notesDir}) — the TODO's commit plus its ` +
      `fixups. Follow the wm:name-critic contract: run the pedant smell table over every name the ` +
      `diff declares. You never read the TODO pair — a name is judged against its own body. ` +
      `Return result PASS/FAIL with failures (file:line — name — smell — the bug it hides — rename).`,
  },
]
const SERIAL = [
  {
    key: 'test',
    phase: 'Test',
    agentType: 'wm:tester',
    prompt:
      lessonsClause +
      safetyClause +
      `Test gate for ${todoPath} (notes-dir ${notesDir}) in TODO mode. The cheap wave is green — the ` +
      `one question left: does a test actually assert this TODO's ## Autotest contract ` +
      `(both Unit and E2E)? No test covers it → WRITE that test first, then run it, and list every ` +
      `file you wrote in wroteTests (you do not commit — the implementer folds them in). ` +
      `Return result FAIL on a red run or a contract you cannot cover, with the real commands and the ` +
      `failures verbatim; PASS when the contract is covered and green.`,
  },
  {
    key: 'outcome',
    phase: 'Review',
    agentType: 'wm:reviewer',
    prompt:
      lessonsClause +
      safetyClause +
      `Outcome gate for ${todoPath} (notes-dir ${notesDir}). Lint, the tests, the comments, and the ` +
      `names are already green — do not re-litigate any of them. Follow the wm:reviewer contract: ` +
      `judge from the TODO pair (Outcome, Surface, Constraints, Changes) + the real diff whether the ` +
      `Outcome is delivered without correctness bugs or spec drift. Return result PASS/FAIL with ` +
      `failures (file:line — scenario — closing edit).`,
  },
]

// ── loop ─────────────────────────────────────────────────────────────────────
let round = 0
const history = []
const fails = { lint: 0, comment: 0, name: 0, test: 0, outcome: 0 }

function blocked(stage, impl) {
  return { result: 'BLOCKED', mode, todo, stage, blocker: impl ? impl.blocker : 'implementer agent died', round, history, compact: compactAsked }
}

let impl = null
if (mode === 'todo') {
  phase('Implement')
  impl = await agent(implPrompt(), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `impl:TODO-${todo}` })
  if (!impl || impl.status === 'blocked') return blocked('initial', impl)
} else {
  // review:sub-diff.md steps 1-2 — resolve the range and derive the intent, because the
  // outcome gate has nothing approved to judge against without them.
  phase('Intent')
  const resolved = await agent(
    `Resolve a review target and report it. Change no file, commit nothing.\n` +
      `1. Resolve "${range}" into one revision range per review:sub-diff.md step 1 — nothing named means the ` +
      `uncommitted working tree (git diff HEAD), "last" means git show HEAD, a branch means that branch against ` +
      `its merge base with the default branch, a sha or range means exactly that, a PR url or number means gh pr diff.\n` +
      `2. Set empty:true when that range holds no change.\n` +
      (intent
        ? `3. The intent is already given — return it verbatim: ${intent}\n`
        : `3. Derive the intent: one sentence saying what this change is for, from the commit messages in the range.\n`),
    { agentType: 'general-purpose', model: 'haiku', phase: 'Intent', schema: INTENT, label: 'intent' },
  )
  if (!resolved) return { result: 'ERROR', mode, stage: 'intent', round, history, compact: compactAsked }
  if (resolved.empty) {
    log(`range ${resolved.range} is empty — reporting it as empty, never as a green run`)
    return { result: 'EMPTY', mode, range: resolved.range, round, history, compact: compactAsked }
  }
  intent = resolved.intent
  log(`range ${resolved.range} — intent: ${intent}`)
}

while (round < MAX_ROUNDS) {
  round++
  let failed = null
  let uncommitted = null

  // The checks: four gates over the same diff, in one parallel batch. They share no state, so the
  // wall clock is the slowest of the four instead of their sum.
  phase('Checks')
  askCompact()
  const CHECKS = checks()
  const checksOut = await parallel(
    CHECKS.map((gate) => () =>
      agent(gate.prompt, { agentType: gate.agentType, phase: 'Checks', schema: GATE, label: `${gate.key}:r${round}` }).then((out) => ({ gate, out })),
    ),
  )
  const checksRuns = checksOut.filter(Boolean)
  const checksDied = CHECKS.filter((g) => !checksRuns.some((r) => r.gate.key === g.key) || !checksRuns.find((r) => r.gate.key === g.key).out)
  if (checksDied.length > 0) return { result: 'ERROR', mode, todo, stage: checksDied.map((g) => g.key).join('+'), round, history, compact: compactAsked }
  for (const { gate, out } of checksRuns) history.push({ round, gate: gate.key, result: out.result, failures: out.failures || [], ran: out.ran || '' })

  // One fixup carries every failing check's findings — separate fixups would each invalidate the
  // next gate's read of the diff.
  const checksFails = checksRuns.filter(({ out }) => out.result === 'FAIL')
  if (checksFails.length > 0) {
    failed = {
      gate: { key: checksFails.map(({ gate }) => gate.key).join('+') },
      out: { failures: checksFails.flatMap(({ gate, out }) => (out.failures || []).map((f) => `[${gate.key}] ${f}`)) },
    }
    for (const { gate } of checksFails) fails[gate.key] += 1
  }

  // The serial gates, in order, only once the checks are green.
  if (!failed) {
    for (const gate of serial()) {
      phase(gate.phase)
      const out = await agent(gate.prompt, { agentType: gate.agentType, phase: gate.phase, schema: GATE, label: `${gate.key}:r${round}` })
      if (!out) return { result: 'ERROR', mode, todo, stage: gate.key, round, history, compact: compactAsked }
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
    return { result: 'PASS', mode, todo, range: mode === 'diff' ? range : undefined, intent, round, summary: impl ? impl.summary : undefined, history, compact: compactAsked }
  }

  if (uncommitted) {
    const files = uncommitted.out.wroteTests
    log(`round ${round}: ${uncommitted.gate.key} gate wrote ${files.length} test file(s) → implementer folds them in`)
    phase('Implement')
    impl = await agent(
      implPrompt(null, `The ${uncommitted.gate.key} gate wrote these test files and left them uncommitted:\n` +
        files.map((f) => `- ${f}`).join('\n') +
        `\nFold them into the commit under review (git commit --amend, or a fixup if the commit was already corrected once). Change nothing else.`),
      { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `commit-tests:r${round}` },
    )
    if (!impl || impl.status === 'blocked') return blocked('commit-tests', impl)
    continue // a new test file can break lint → restart the chain at the cheap gate
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
      compact: compactAsked,
    }
  }

  phase('Implement')
  impl = await agent(implPrompt(failures), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `fixup-${failed.gate.key}:r${round}` })
  if (!impl || impl.status === 'blocked') return blocked(`${failed.gate.key}-fixup`, impl)
  // A fixup can break what an earlier gate already cleared → restart the chain, never resume.
}

log(`${mode === 'todo' ? `TODO-${todo}` : range}: hit MAX_ROUNDS=${MAX_ROUNDS} without every gate green — stopping (backstop, not a silent truncation)`)
return { result: 'MAX_ROUNDS', mode, todo, round, history, compact: compactAsked }
