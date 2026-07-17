export const meta = {
  name: 'wm-code-impl',
  description: 'Implement one wm TODO through the implement → lint → review loop until both gates pass',
  whenToUse: 'Driving /code impl deterministically: sonnet implements + commits, haiku gates lint+tests, opus gates Outcome/correctness; each FAIL routes back to a fixup until both gates are green.',
  phases: [
    { title: 'Implement', detail: 'wm:implementer (sonnet) writes + commits', model: 'sonnet' },
    { title: 'Lint', detail: 'wm:lint-tester (haiku) gates lint + related tests', model: 'haiku' },
    { title: 'Review', detail: 'wm:reviewer (opus) gates Outcome / correctness', model: 'opus' },
  ],
}

// ── args: { todo: <N>, notesDir?: ".notes" } ─────────────────────────────────
const notesDir = (args && args.notesDir) || '.notes'
const todo = args && args.todo
if (todo === undefined || todo === null) {
  throw new Error('Pass args { todo: <N>, notesDir?: ".notes" } — which TODO to implement')
}
const todoPath = `${notesDir}/todos/TODO-${todo}.md`

// Backstop only. The loop is unbounded-until-green (the user's chosen contract);
// real termination is the implementer's own hard-stop returning status:"blocked".
// This cap prevents the 1000-agent runaway backstop and is logged if ever hit
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
function implPrompt(failures) {
  const base =
    `Implement exactly one TODO: ${todoPath} (notes-dir ${notesDir}). ` +
    `Follow ${PLUGIN}/skills/code/commands/sub-impl.md steps 1-4 (read context, replan guard, implement, glossary). ` +
    `Run the TODO's ## Autotest; it must be green before committing. Commit per ${PLUGIN}/skills/code/commands/sub-commit.md. ` +
    `Return status:"done" once green + committed, or status:"blocked" with the blocker if you hit a hard-stop ` +
    `(3+ edits without green, 2 failed fix attempts, tool/permission error, or a request to replan).`
  if (!failures || failures.length === 0) return base
  return (
    `${base}\n\nCORRECTION round — a gate failed. Address these failures, then commit a FIXUP ` +
    `(git commit --fixup=<sha-being-corrected>), never a plain commit:\n` +
    failures.map((f) => `- ${f}`).join('\n')
  )
}

const lintPrompt =
  `Lint gate for ${todoPath} (notes-dir ${notesDir}). Follow the wm:lint-tester contract: ` +
  `from the diff + the TODO's Files, lint the changed files with the repo's configured linter, ` +
  `run the TODO's Autotest and the tests covering the changed files. Return result PASS/FAIL, ` +
  `failures verbatim, and the real commands you ran.`

const reviewPrompt =
  `Review gate for ${todoPath} (notes-dir ${notesDir}). Lint + tests are already green — do not ` +
  `re-litigate them. Follow the wm:reviewer contract: judge from the TODO (Outcome, Changes, ` +
  `Decisions) + the real diff whether the Outcome is delivered without correctness bugs or spec ` +
  `drift. Return result PASS/FAIL with failures (file:line — scenario — closing edit).`

// ── loop ─────────────────────────────────────────────────────────────────────
function blocked(stage, impl) {
  return { result: 'BLOCKED', todo, stage, blocker: impl ? impl.blocker : 'implementer agent died', round }
}

let round = 0

phase('Implement')
let impl = await agent(implPrompt(), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `impl:TODO-${todo}` })
if (!impl || impl.status === 'blocked') return blocked('initial', impl)

while (round < MAX_ROUNDS) {
  round++

  // ── cheap gate: lint + related tests (haiku) ──
  phase('Lint')
  const lint = await agent(lintPrompt, { agentType: 'wm:lint-tester', phase: 'Lint', schema: GATE, label: `lint:r${round}` })
  if (!lint) return { result: 'ERROR', todo, stage: 'lint', round }
  if (lint.result === 'FAIL') {
    log(`round ${round}: LINT FAIL (${(lint.failures || []).length} issues) → implementer fixup`)
    phase('Implement')
    impl = await agent(implPrompt(lint.failures), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `fixup-lint:r${round}` })
    if (!impl || impl.status === 'blocked') return blocked('lint-fixup', impl)
    continue // re-lint from the top
  }

  // ── expensive gate: Outcome / correctness / drift (opus) ──
  phase('Review')
  const review = await agent(reviewPrompt, { agentType: 'wm:reviewer', phase: 'Review', schema: GATE, label: `review:r${round}` })
  if (!review) return { result: 'ERROR', todo, stage: 'review', round }
  if (review.result === 'FAIL') {
    log(`round ${round}: REVIEW FAIL (${(review.failures || []).length} findings) → implementer fixup`)
    phase('Implement')
    impl = await agent(implPrompt(review.failures), { agentType: 'wm:implementer', phase: 'Implement', schema: IMPL, label: `fixup-review:r${round}` })
    if (!impl || impl.status === 'blocked') return blocked('review-fixup', impl)
    continue // a review fixup can break lint/tests → re-lint, then re-review
  }

  // both gates green
  log(`TODO-${todo} green after ${round} round(s)`)
  return { result: 'PASS', todo, round, summary: impl.summary }
}

log(`TODO-${todo}: hit MAX_ROUNDS=${MAX_ROUNDS} without both gates green — stopping (backstop, not a silent truncation)`)
return { result: 'MAX_ROUNDS', todo, round }
