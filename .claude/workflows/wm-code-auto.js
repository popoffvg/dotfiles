export const meta = {
  name: 'wm-code-auto',
  description: 'Drive the whole wm ledger unattended: every open TODO through the gate chain, then optional deploy, then the E2E verification',
  whenToUse: 'Running /code auto deterministically: read the ledger, run wm-code-impl per open TODO in wave order, carry LESSONS.md between rounds, block a stuck TODO and drop its dependents, then deploy (optional) and verify end-to-end. The gates replace the human — nothing pauses for approval.',
  phases: [
    { title: 'Ledger', detail: 'read spec.md + every todos/TODO-N.md → the work list', model: 'haiku' },
    { title: 'Lessons', detail: 'append what the round taught to LESSONS.md', model: 'haiku' },
    { title: 'Status', detail: 'verify→done | blocked, ledger row, jj commit the notes-dir', model: 'haiku' },
    { title: 'Deploy', detail: 'the project deploy task — skipped when absent or turned off', model: 'haiku' },
    { title: 'Verify', detail: "the last ledger TODO's E2E command", model: 'haiku' },
    { title: 'Fix', detail: 'sub-fix.md on a red deploy or a red E2E', model: 'sonnet' },
  ],
}

// ── args: { notesDir?: ".notes", deploy?: <cmd> | false, maxGateFails?: 3 } ───
// deploy omitted → probe for the project's deploy task; a string → run that command;
// false → this ledger does not deploy, skip without probing.
const notesDir = (args && args.notesDir) || '.notes'
const deployArg = args && Object.prototype.hasOwnProperty.call(args, 'deploy') ? args.deploy : undefined
const maxGateFails = (args && args.maxGateFails) || 3
const lessonsFile = `${notesDir}/LESSONS.md`

// Backstop for the tail: a deploy or E2E that stays red after this many fix rounds
// stops the run and is reported as such (never a silent truncation).
const MAX_TAIL_ROUNDS = 3

// ── schemas ──────────────────────────────────────────────────────────────────
const LEDGER = {
  type: 'object',
  additionalProperties: false,
  required: ['todos', 'e2eCommand'],
  properties: {
    todos: {
      type: 'array',
      description: 'every TODO whose status is not done, in wave order',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['todo', 'status'],
        properties: {
          todo: { type: 'string', description: 'the N of todos/TODO-N.md' },
          wave: { type: 'string' },
          status: { type: 'string' },
          dependsOn: { type: 'array', items: { type: 'string' }, description: 'the N of each depends_on TODO' },
        },
      },
    },
    e2eCommand: { type: 'string', description: "the E2E command from the LAST ledger TODO's ## Autotest, or the literal none" },
    e2eTodo: { type: 'string', description: 'which TODO that E2E command came from' },
    deployTask: { type: ['string', 'null'], description: 'the project deploy command if one is configured, else null' },
    lessonsCreated: { type: 'boolean', description: 'true when LESSONS.md did not exist and you created it' },
  },
}
const SCRIBE = {
  type: 'object',
  additionalProperties: false,
  required: ['appended'],
  properties: { appended: { type: 'array', items: { type: 'string' }, description: 'the lines added to LESSONS.md, verbatim' } },
}
const STATUS = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', description: 'the status now in the TODO frontmatter' },
    commit: { type: 'string', description: 'the sha written into the ledger row' },
  },
}
const RUN = {
  type: 'object',
  additionalProperties: false,
  required: ['result', 'ran'],
  properties: {
    result: { enum: ['green', 'red'] },
    ran: { type: 'string', description: 'the command, verbatim' },
    output: { type: 'string', description: 'the real output — the failing part when red' },
  },
}

// ── step 1 · the ledger ──────────────────────────────────────────────────────
const PLUGIN = '${CLAUDE_PLUGIN_ROOT}'

phase('Ledger')
const ledger = await agent(
  `Read the wm ledger in ${notesDir} and report it. Do not edit source, do not implement anything.\n` +
    `1. Read ${notesDir}/spec.md (frontmatter, the ledger, the ## Plan wave table) and every ${notesDir}/todos/TODO-N.md.\n` +
    `2. Return every TODO whose frontmatter status is not "done", ordered by the wave table (widest wave first) ` +
    `and, inside a wave, by ascending layer — the order ${PLUGIN}/skills/arch/references/ref-write.md § TODO ordering and waves defines. ` +
    `Carry each one's depends_on as the bare TODO numbers.\n` +
    `3. Return e2eCommand: the E2E command from the ## Autotest of the LAST TODO in the ledger (the literal string "none" if that level is written none), and e2eTodo.\n` +
    `4. Return deployTask: the project's deploy command if one is configured (read ${notesDir}/CLAUDE.md, then mise tasks / Makefile / package.json scripts — do not invent one), else null.\n` +
    `5. Create ${lessonsFile} if it is missing — an empty file with the heading "# Lessons" and nothing else — and set lessonsCreated.`,
  { agentType: 'general-purpose', model: 'haiku', phase: 'Ledger', schema: LEDGER, label: 'ledger' },
)
if (!ledger) return { result: 'ERROR', stage: 'ledger' }

const workList = ledger.todos || []
log(`work list: ${workList.length ? workList.map((t) => `TODO-${t.todo}(${t.status})`).join(' → ') : '(empty — straight to the tail)'}`)

// ── step 2 · the TODO round, once per TODO ───────────────────────────────────
const done = []
const blocked = []
const skipped = []
const lessons = []

for (const item of workList) {
  const deps = item.dependsOn || []
  const blocker = deps.find((d) => blocked.some((b) => b.todo === d) || skipped.some((s) => s.todo === d))
  if (blocker) {
    skipped.push({ todo: item.todo, reason: `depends_on TODO-${blocker}, which is blocked` })
    log(`TODO-${item.todo}: skipped — depends on blocked TODO-${blocker}`)
    continue
  }

  log(`TODO-${item.todo} (${item.wave || 'no wave'}) → gate chain`)
  // A child that throws blocks its TODO — it never ends the run (sub-auto.md Step 2, last rule).
  let round = null
  try {
    round = await workflow('wm-code-impl', { todo: item.todo, notesDir, lessonsFile, maxGateFails })
  } catch (err) {
    round = { result: 'ERROR', stage: 'child-workflow', blocker: `wm-code-impl threw: ${err && err.message ? err.message : err}` }
    log(`TODO-${item.todo}: ${round.blocker}`)
  }
  const outcome = round && round.result === 'PASS' ? 'done' : 'blocked'

  // 2.7 — what the round taught, before the status is settled.
  phase('Lessons')
  const scribe = await agent(
    `Append to ${lessonsFile} what implementing ${notesDir}/todos/TODO-${item.todo}.md just taught. Append only — never rewrite an existing entry.\n` +
      `Write, from the gate history below: the findings that were real, the findings that were rejected plus the command that settled them, ` +
      `the gaps carried to a later TODO, and the process facts. Group each entry by WHEN the lesson bites (the file or step it applies to), ` +
      `not by which gate produced it, and name the Files it touches so a later round can match it.\n` +
      (outcome === 'blocked'
        ? `This TODO is BLOCKED — record the blocker as its own entry: ${round ? round.blocker || round.result : 'the child workflow died'}\n`
        : '') +
      `Gate history (JSON): ${JSON.stringify(round && round.history ? round.history : [])}\n` +
      `Return the lines you appended, verbatim.`,
    { agentType: 'general-purpose', model: 'haiku', phase: 'Lessons', schema: SCRIBE, label: `lessons:TODO-${item.todo}` },
  )
  if (scribe) lessons.push(...(scribe.appended || []))

  // 2.8 — settle the status, then commit the notes.
  phase('Status')
  const status = await agent(
    `Settle the bookkeeping for ${notesDir}/todos/TODO-${item.todo}.md. Touch no project source.\n` +
      (outcome === 'done'
        ? `Every gate is green: set the frontmatter status to "done" and fill this TODO's ledger row Commit in ${notesDir}/spec.md with the real sha (git log).\n`
        : `The ${round ? round.stage : 'child workflow'} gate did not clear: set the frontmatter status to "blocked" and leave the ledger row's Commit as it is.\n`) +
      `Then commit the notes-dir as ${PLUGIN}/skills/code/references/ref-jj-notes.md says. Return the status you wrote and the sha (empty when blocked).`,
    { agentType: 'general-purpose', model: 'haiku', phase: 'Status', schema: STATUS, label: `status:TODO-${item.todo}` },
  )

  if (outcome === 'done') {
    done.push({ todo: item.todo, rounds: round.round, summary: round.summary, commit: status ? status.commit : undefined })
  } else {
    blocked.push({ todo: item.todo, stage: round ? round.stage : 'child-died', blocker: round ? round.blocker || round.result : 'the child workflow died' })
  }
}

// ── steps 3 + 4 · deploy, then verify end-to-end ─────────────────────────────
function resolveDeploy() {
  if (deployArg === false) return { skipped: 'args.deploy false' }
  if (typeof deployArg === 'string' && deployArg.length > 0) return { cmd: deployArg }
  if (ledger.deployTask) return { cmd: ledger.deployTask }
  return { skipped: 'no deploy task configured' }
}

function runPrompt(cmd, what) {
  return (
    `Run the project's ${what} command and report it, nothing else: ${cmd}\n` +
    `Return result "green" only when it exits 0. Return the command verbatim in ran, and the real output ` +
    `(the failing part, not a summary of intent) in output. Change no files.`
  )
}

async function fix(what, run) {
  phase('Fix')
  return agent(
    `The ${what} command came back red. Close it as a gap: follow ${PLUGIN}/skills/impl/commands/sub-fix.md — fix the thought in ${notesDir} first, then the code — and commit per ${PLUGIN}/skills/impl/commands/sub-commit.md. ` +
      `Read ${lessonsFile} in full before you edit.\n` +
      `Command: ${run ? run.ran : '(agent died)'}\nOutput:\n${run ? run.output || '(none reported)' : '(none)'}`,
    { agentType: 'wm:implementer', phase: 'Fix', label: `fix:${what}` },
  )
}

const tail = { deploy: null, verify: null }
let deployRan = false
let tailRound = 0
let tailStop = null

while (true) {
  tailRound += 1
  if (tailRound > MAX_TAIL_ROUNDS) {
    tailStop = `tail stayed red after ${MAX_TAIL_ROUNDS} fix rounds`
    log(`${tailStop} — stopping (backstop, not a silent truncation)`)
    break
  }

  const deploy = resolveDeploy()
  if (deploy.skipped) {
    tail.deploy = { skipped: deploy.skipped }
    deployRan = false
  } else {
    phase('Deploy')
    const run = await agent(runPrompt(deploy.cmd, 'deploy'), { agentType: 'general-purpose', model: 'haiku', phase: 'Deploy', schema: RUN, label: `deploy:r${tailRound}` })
    deployRan = true
    tail.deploy = run || { result: 'red', ran: deploy.cmd, output: 'deploy agent died' }
    if (tail.deploy.result !== 'green') {
      log(`deploy red (round ${tailRound}) → fix, then re-run the deploy`)
      await fix('deploy', tail.deploy)
      continue
    }
  }

  const e2e = ledger.e2eCommand
  if (!e2e || e2e.toLowerCase() === 'none') {
    tail.verify = { skipped: `the last ledger TODO (TODO-${ledger.e2eTodo}) declares E2E none` }
    break
  }

  phase('Verify')
  const run = await agent(runPrompt(e2e, 'end-to-end verification'), { agentType: 'general-purpose', model: 'haiku', phase: 'Verify', schema: RUN, label: `e2e:r${tailRound}` })
  tail.verify = run || { result: 'red', ran: e2e, output: 'verify agent died' }
  if (tail.verify.result !== 'green') {
    // Deploy ran → the fix must be re-deployed, so the tail restarts at the deploy.
    // Deploy was skipped → re-resolving skips it again, so the same restart re-runs the E2E alone.
    log(`E2E red (round ${tailRound}) → fix, then re-run ${deployRan ? 'from the deploy' : 'the E2E'}`)
    await fix('end-to-end verification', tail.verify)
    continue
  }
  break
}

// ── step 5 · the report ──────────────────────────────────────────────────────
log(`done: ${done.length} · blocked: ${blocked.length} · skipped: ${skipped.length} · deploy: ${tail.deploy && tail.deploy.skipped ? `skipped (${tail.deploy.skipped})` : tail.deploy && tail.deploy.result} · e2e: ${tail.verify && tail.verify.skipped ? `skipped (${tail.verify.skipped})` : tail.verify && tail.verify.result}`)

return {
  result: tailStop ? 'TAIL_RED' : blocked.length || skipped.length ? 'PARTIAL' : 'PASS',
  done,
  blocked,
  skipped,
  deploy: tail.deploy,
  verify: tail.verify,
  lessons,
  stopped: tailStop,
}
