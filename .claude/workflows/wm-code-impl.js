export const meta = {
  name: 'wm-code-impl',
  description: 'Implement one wm TODO through the implement → lint → review → test loop until every gate passes',
  whenToUse: 'Driving /code impl deterministically: sonnet implements + commits, haiku gates lint+tests, opus gates Outcome/correctness, sonnet gates the Autotest contract; each FAIL routes back to a fixup until every gate is green. wm-code-auto calls this once per TODO.',
  phases: [
    { title: 'Implement', detail: 'wm:implementer (sonnet) writes + commits', model: 'sonnet' },
    { title: 'Lint', detail: 'wm:lint-tester (haiku) gates lint + related tests', model: 'haiku' },
    { title: 'Review', detail: 'wm:reviewer (opus) gates Outcome / correctness', model: 'opus' },
    { title: 'Test', detail: 'wm:tester (sonnet) gates the Autotest contract', model: 'sonnet' },
  ],
}

// ── args: { todo: <N>, notesDir?: ".notes", lessonsFile?, maxGateFails? } ─────
const notesDir = (args && args.notesDir) || '.notes'
const todo = args && args.todo
if (todo === undefined || todo === null) {
  throw new Error('Pass args { todo: <N>, notesDir?: ".notes" } — which TODO to implement')
}
const todoPath = `${notesDir}/todos/TODO-${todo}.md`

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

// ── prompts ────────────────────────────────────────────────────────────────
const PLUGIN = '${CLAUDE_PLUGIN_ROOT}'
const lessonsClause = lessonsFile
  ? `FIRST read ${lessonsFile} in full — every round, before any edit — and obey every entry whose Files overlap this TODO's Files. `
  : ''

function implPrompt(failures, extra) {
  const base =
    lessonsClause +
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

// The gate chain, cheapest first. A row is one gate; the loop below reads it.
const GATES = [
  {
    key: 'lint',
    phase: 'Lint',
    agentType: 'wm:lint-tester',
    prompt:
      `Lint gate for ${todoPath} (notes-dir ${notesDir}). Follow the wm:lint-tester contract: ` +
      `from the diff + the TODO's Files, lint the changed files with the repo's configured linter, ` +
      `run the TODO's Autotest and the tests covering the changed files. Return result PASS/FAIL, ` +
      `failures verbatim, and the real commands you ran.`,
  },
  {
    key: 'review',
    phase: 'Review',
    agentType: 'wm:reviewer',
    prompt:
      `Review gate for ${todoPath} (notes-dir ${notesDir}). Lint + tests are already green — do not ` +
      `re-litigate them. Follow the wm:reviewer contract: judge from the TODO (Outcome, Changes, ` +
      `Decisions) + the real diff whether the Outcome is delivered without correctness bugs or spec ` +
      `drift. Return result PASS/FAIL with failures (file:line — scenario — closing edit).`,
  },
  {
    key: 'test',
    phase: 'Test',
    agentType: 'wm:tester',
    prompt:
      `Test gate for ${todoPath} (notes-dir ${notesDir}) in TODO mode. Lint is green and the review ` +
      `passed — the one question left: does a test actually assert this TODO's ## Autotest contract ` +
      `(both Unit and E2E)? No test covers it → WRITE that test first, then run it, and list every ` +
      `file you wrote in wroteTests (you do not commit — the implementer folds them in). ` +
      `Return result FAIL on a red run or a contract you cannot cover, with the real commands and the ` +
      `failures verbatim; PASS when the contract is covered and green.`,
  },
]

// ── loop ─────────────────────────────────────────────────────────────────────
let round = 0
const history = []
const fails = { lint: 0, review: 0, test: 0 }

function blocked(stage, impl) {
  return { result: 'BLOCKED', todo, stage, blocker: impl ? impl.blocker : 'implementer agent died', round, history }
}

phase('Implement')
let impl = await agent(implPrompt(), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `impl:TODO-${todo}` })
if (!impl || impl.status === 'blocked') return blocked('initial', impl)

while (round < MAX_ROUNDS) {
  round++
  let failed = null
  let uncommitted = null

  for (const gate of GATES) {
    phase(gate.phase)
    const out = await agent(gate.prompt, { agentType: gate.agentType, phase: gate.phase, schema: GATE, label: `${gate.key}:r${round}` })
    if (!out) return { result: 'ERROR', todo, stage: gate.key, round, history }
    history.push({ round, gate: gate.key, result: out.result, failures: out.failures || [], ran: out.ran || '' })
    if (out.result === 'FAIL') {
      failed = { gate, out }
      break
    }
    // A gate that wrote a test left it uncommitted — fold it in, then run the chain again.
    if ((out.wroteTests || []).length > 0) {
      uncommitted = { gate, out }
      break
    }
  }

  if (!failed && !uncommitted) {
    log(`TODO-${todo} green on every gate after ${round} round(s)`)
    return { result: 'PASS', todo, round, summary: impl.summary, history }
  }

  if (uncommitted) {
    const files = uncommitted.out.wroteTests
    log(`round ${round}: ${uncommitted.gate.key} gate wrote ${files.length} test file(s) → implementer folds them in`)
    phase('Implement')
    impl = await agent(
      implPrompt(null, `The ${uncommitted.gate.key} gate wrote these test files and left them uncommitted:\n` +
        files.map((f) => `- ${f}`).join('\n') +
        `\nFold them into the TODO's commit (git commit --amend, or a fixup if the commit was already corrected once). Change nothing else.`),
      { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `commit-tests:r${round}` },
    )
    if (!impl || impl.status === 'blocked') return blocked('commit-tests', impl)
    continue // a new test file can break lint → restart the chain at the cheap gate
  }

  fails[failed.gate.key] += 1
  const failures = failed.out.failures || []
  log(`round ${round}: ${failed.gate.key.toUpperCase()} FAIL (${failures.length} findings, ${fails[failed.gate.key]}/${maxGateFails || '∞'}) → implementer fixup`)

  if (maxGateFails && fails[failed.gate.key] >= maxGateFails) {
    return {
      result: 'BLOCKED',
      todo,
      stage: failed.gate.key,
      blocker: `${failed.gate.key} gate failed ${fails[failed.gate.key]} rounds; last findings: ${failures.join(' | ') || '(none reported)'}`,
      round,
      history,
    }
  }

  phase('Implement')
  impl = await agent(implPrompt(failures), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `fixup-${failed.gate.key}:r${round}` })
  if (!impl || impl.status === 'blocked') return blocked(`${failed.gate.key}-fixup`, impl)
  // A fixup can break what an earlier gate already cleared → restart the chain, never resume.
}

log(`TODO-${todo}: hit MAX_ROUNDS=${MAX_ROUNDS} without every gate green — stopping (backstop, not a silent truncation)`)
return { result: 'MAX_ROUNDS', todo, round, history }
