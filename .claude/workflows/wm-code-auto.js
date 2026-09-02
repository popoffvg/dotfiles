export const meta = {
  name: 'wm-code-auto',
  description: 'Drive the whole wm ledger unattended: every open TODO through the gate chain, then optional deploy, then the E2E verification',
  whenToUse: 'Running /code auto deterministically: read the ledger, run wm-code-impl per open TODO in wave order, carry LESSONS.md between rounds, block a stuck TODO and drop its dependents, then deploy (optional) and verify end-to-end. The gates replace the human — nothing pauses for approval.',
  phases: [
    { title: 'Ledger', detail: 'read spec.md + every todos/TODO-N.md → the work list', model: 'haiku' },
    { title: 'Squash', detail: "fold the round's fixups into the TODO's one commit, distilling them into skills" },
    { title: 'Lessons', detail: 'append what the round taught to LESSONS.md', model: 'haiku' },
    { title: 'Capture', detail: 'capture-lesson on what the round taught outside the fixups' },
    { title: 'Status', detail: 'verify→done | blocked, ledger row, jj commit the notes-dir', model: 'haiku' },
    { title: 'Deploy', detail: 'the project deploy task — skipped when absent or turned off', model: 'haiku' },
    { title: 'Verify', detail: "the last ledger TODO's E2E command", model: 'haiku' },
    { title: 'Fix', detail: 'sub-fix.md on a red deploy or a red E2E', model: 'sonnet' },
    { title: 'Reconcile', detail: 'read every TODO status back off disk so the report matches the notes', model: 'haiku' },
  ],
}

// ── args: { notesDir?: ".notes", deploy?: <cmd> | false, maxGateFails?: 3 } ───
// deploy omitted → probe for the project's deploy task; a string → run that command;
// false → this ledger does not deploy, skip without probing.
//
// A slash invocation delivers args as TEXT, and reading a field off a string yields undefined, so
// unparsed args read as "caller passed nothing" and every value silently reverts to its default.
// Here that includes `deploy: false`, which means an unattended run would deploy a ledger the
// caller said must not deploy. Parse the text, and refuse anything whose meaning is a guess.
function parseArgs(raw) {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'object') return raw
  const text = String(raw).trim()
  if (text === '') return {}
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch (err) {
      throw new Error(`args looks like JSON but does not parse: ${text} — ${err.message}`)
    }
  }
  throw new Error(`args must be an object like { notesDir, deploy, maxGateFails } — got ${text}. A bare word cannot be read as one, and guessing wrong here can deploy a ledger you meant to skip.`)
}
const parsed = parseArgs(typeof args === 'undefined' ? null : args)

const notesDir = parsed.notesDir || '.notes'
const deployArg = Object.prototype.hasOwnProperty.call(parsed, 'deploy') ? parsed.deploy : undefined
const maxGateFails = parsed.maxGateFails || 3
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
    outcome: { type: 'string', description: "one plain-words sentence: what the system does now, in the domain's words, no symbols and no paths" },
  },
}
const TRUTH = {
  type: 'object',
  additionalProperties: false,
  required: ['statuses'],
  properties: {
    statuses: {
      type: 'array',
      description: 'one row per TODO read back from its frontmatter on disk',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['todo', 'status'],
        properties: {
          todo: { type: 'string', description: 'the bare N of todos/TODO-N.md' },
          status: { type: 'string', description: 'the frontmatter status verbatim' },
        },
      },
    },
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

// sub-auto.md says it outright: nobody is watching. wm-code-impl carries this clause on every agent
// it spawns, and this workflow — the one that actually runs a deploy command and hands an
// implementer a red command to close — carried it on none. A setup task is written for a fresh
// machine: it provisions credentials and writes stores global to the user, not scoped to this
// checkout. One such command regenerated a keychain vault password and made an encrypted file
// unreadable for every checkout on the machine, with the old password unrecoverable. Every agent
// here that runs a command or writes a commit gets it.
const safetyClause =
  `SAFETY, because this run is unattended: never run a project bootstrap, setup, provisioning or ` +
  `credential command — anything like "<runner> run setup", "make setup", a bootstrap/install script, ` +
  `or a command that writes a keychain, credential store, dotenv or secret, or that generates or ` +
  `rotates a key. These are global to the machine and destroy state other checkouts depend on, often ` +
  `irreversibly. Run only the command this brief names. If it fails because the environment is ` +
  `missing something, report that as the failure, naming exactly what is missing — let a human ` +
  `install it. Never put a secret value in anything you return. `

phase('Ledger')
const ledger = await agent(
  `Read the wm ledger in ${notesDir} and report it. Do not edit source, do not implement anything.\n` +
    `1. Read ${notesDir}/spec.md (frontmatter, the ledger, the ## Plan wave table) and every ${notesDir}/todos/TODO-N.md.\n` +
    `2. Return every TODO whose frontmatter status is not "done", ordered by the wave table (widest wave first) ` +
    `and, inside a wave, by ascending layer — the order ${PLUGIN}/skills/arch/references/ref-write.md § TODO ordering and waves defines. ` +
    `Carry each one's depends_on as the bare TODO numbers.\n` +
    `3. Return e2eCommand: the E2E command from the ## Autotest of the LAST TODO in the ledger (the literal string "none" if that level is written none), and e2eTodo.\n` +
    `4. Return deployTask: the project's deploy command if one is configured (read ${notesDir}/CLAUDE.md, then mise tasks / Makefile / package.json scripts — do not invent one), else null.\n` +
    `5. Create ${lessonsFile} if it is missing and set lessonsCreated. Do NOT leave it empty — the first TODO ` +
    `runs against whatever this file says, so an empty file guarantees the first round learns the environment the ` +
    `hard way. Seed it with an "## Environment" section stating how this repo must be built and tested, read off ` +
    `the repo's own pins: the runtime version and where it is pinned (.mise.toml, .nvmrc, engines), the command ` +
    `runner that supplies it (e.g. "run node through 'mise exec --' — the system node is a different version"), ` +
    `and the exact lint and test commands the CI workflow runs. Mark that section "applies to every TODO". ` +
    `State only what the pin files and CI config actually say — do not guess.`,
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
const squashFailures = []

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

  // 2.4 — one commit per TODO: the gate fixups fold back into it. A blocked round has
  // nothing green to fold into, so it skips straight to the lessons.
  if (outcome === 'done') {
    phase('Squash')
    const squashed = await agent(
      safetyClause +
        `Squash the fixup trail of ${notesDir}/todos/TODO-${item.todo}.md: follow ${PLUGIN}/skills/impl/commands/sub-squash.md, scoped to THIS TODO only.\n` +
        `Fold every --fixup commit this round produced into the TODO's own commit (git rebase --autosquash), so the TODO leaves exactly one commit behind. ` +
        `Touch no commit that belongs to an earlier TODO.\n` +
        `Its distill step is where a fixup becomes a skill — invoke the capture-lesson skill on every repeatable mistake the fixups reveal, and skip the one-off typos.\n` +
        `Gate history (JSON): ${JSON.stringify(round && round.history ? round.history : [])}`,
      { agentType: 'wm:implementer', phase: 'Squash', label: `squash:TODO-${item.todo}` },
    )
    // The one-commit-per-TODO rule (sub-auto.md step 2.4) is claimed by the status this loop writes
    // next. A squash that died leaves the fixup trail in history while the TODO still goes done, so
    // the claim and the history disagree and nothing says which one to trust.
    if (!squashed) {
      squashFailures.push(item.todo)
      log(`TODO-${item.todo}: the squash agent returned nothing — its fixup trail is still in history, unfolded`)
    }
  }

  // 2.5 — what the round taught, before the status is settled.
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
  // A scribe can die (a classifier refusal killed the one for a blocked TODO in the motivating run).
  // Say so — a lost lesson that nobody hears about is how the next round repeats this round's mistake.
  if (scribe) lessons.push(...(scribe.appended || []))
  else log(`TODO-${item.todo}: the lessons scribe returned nothing — this round taught ${lessonsFile} nothing`)

  // 2.6 — LESSONS.md holds the round for this run; a skill holds it for every future one.
  phase('Capture')
  await agent(
    `Invoke the capture-lesson skill (self-improvement plugin) on what implementing ${notesDir}/todos/TODO-${item.todo}.md taught OUTSIDE its fixups — ` +
      `a finding a gate rejected plus the command that settled it, a repo convention a gate named, a gap carried to a later TODO. ` +
      `The fixups themselves were already captured by the squash step; do not file them twice.\n` +
      `Follow the skill's own bar: a lesson that overrides no default is skipped, not filed.\n` +
      `Gate history (JSON): ${JSON.stringify(round && round.history ? round.history : [])}\n` +
      `Lines just appended to ${lessonsFile}: ${JSON.stringify(scribe ? scribe.appended || [] : [])}`,
    { agentType: 'general-purpose', phase: 'Capture', label: `capture:TODO-${item.todo}` },
  )

  // 2.7 — settle the status, then commit the notes.
  phase('Status')
  const status = await agent(
    safetyClause +
      `Settle the bookkeeping for ${notesDir}/todos/TODO-${item.todo}.md. Touch no project source.\n` +
      (outcome === 'done'
        ? `Every gate is green: set the frontmatter status to "done" and fill this TODO's ledger row Commit in ${notesDir}/spec.md with the real sha (git log).\n` +
          `Then return outcome: one sentence of plain words saying what the system does now that it did not do before, ` +
          `read off the TODO's ## Outcome — the domain's words, no file paths, no symbol names, no shas. It is the line ` +
          `a reader who never opens the diff gets (${PLUGIN}/skills/impl/commands/sub-impl.md step 9).\n`
        : `The ${round ? round.stage : 'child workflow'} gate did not clear: set the frontmatter status to "blocked" and leave the ledger row's Commit as it is.\n`) +
      `Then commit the notes-dir as ${PLUGIN}/skills/code/references/ref-jj-notes.md says. Return the status you wrote and the sha (empty when blocked).`,
    { agentType: 'general-purpose', model: 'haiku', phase: 'Status', schema: STATUS, label: `status:TODO-${item.todo}` },
  )

  if (outcome === 'done') {
    done.push({
      todo: item.todo,
      rounds: round.round,
      outcome: status ? status.outcome : undefined,
      summary: round.summary,
      commit: status ? status.commit : undefined,
    })
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
    safetyClause +
    `Run the project's ${what} command and report it, nothing else: ${cmd}\n` +
    `Return result "green" only when it exits 0. Return the command verbatim in ran, and the real output ` +
    `(the failing part, not a summary of intent) in output. Change no files.`
  )
}

async function fix(what, run) {
  phase('Fix')
  return agent(
    safetyClause +
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

// ── step 4.5 · reconcile the report against the notes on disk ────────────────
// The tail's fix rounds run wm:implementer, which can finish a TODO the loop already recorded as
// blocked — that is exactly what happened to TODO-1 in the run that motivated this step: it shipped
// during a fix round while the returned report still called it blocked, and a reader who trusts the
// report re-runs work that is already done. The frontmatter on disk is the ground truth, so read it
// back before reporting instead of trusting a list built earlier in the run.
phase('Reconcile')
const truth = await agent(
  `Report the frontmatter status of each of these TODO files, nothing else. Change no files, run no tests.\n` +
    workList.map((t) => `- ${notesDir}/todos/TODO-${t.todo}.md`).join('\n') +
    `\nFor each, return its bare TODO number and the status string exactly as its frontmatter says.`,
  { agentType: 'general-purpose', model: 'haiku', phase: 'Reconcile', schema: TRUTH, label: 'reconcile' },
)

const corrections = []
if (truth && Array.isArray(truth.statuses)) {
  const onDisk = new Map(truth.statuses.map((s) => [String(s.todo), String(s.status || '').toLowerCase()]))
  // A moved entry keeps the shape of the list it left, so a row corrected into `blocked` arrives
  // with no blocker and a row corrected into `done` with no outcome line. Stamp the reason on the
  // way across: the report is the only place this correction is ever stated.
  const move = (from, to, want) => {
    for (let i = from.length - 1; i >= 0; i -= 1) {
      const entry = from[i]
      const actual = onDisk.get(String(entry.todo))
      if (actual === undefined) continue
      const isDone = actual === 'done'
      if (isDone !== want) continue
      const reason = `TODO-${entry.todo}: reported ${want ? 'not done' : 'done'}, notes say ${actual}`
      from.splice(i, 1)
      to.push({ ...entry, reconciled: reason, blocker: want ? undefined : entry.blocker || `notes say status ${actual}, never done` })
      corrections.push(reason)
    }
  }
  move(blocked, done, true) // recorded blocked, finished later by a fix round
  move(skipped, done, true) // recorded skipped, but its notes say it landed
  move(done, blocked, false) // recorded done, but its notes never reached done
}
if (corrections.length) log(`reconciled against the notes: ${corrections.join(' · ')}`)

// ── step 5 · the report ──────────────────────────────────────────────────────
log(`done: ${done.length} · blocked: ${blocked.length} · skipped: ${skipped.length} · deploy: ${tail.deploy && tail.deploy.skipped ? `skipped (${tail.deploy.skipped})` : tail.deploy && tail.deploy.result} · e2e: ${tail.verify && tail.verify.skipped ? `skipped (${tail.verify.skipped})` : tail.verify && tail.verify.result}`)
if (squashFailures.length) log(`unfolded fixup trails: ${squashFailures.map((t) => `TODO-${t}`).join(' ')}`)

// PASS means the Step 0 goal holds: TODOs done, deploy green, E2E green. A run that implemented
// nothing and skipped both tail steps proves none of that, so it reports what it is instead of
// borrowing the word for a green run.
const ranNothing = done.length === 0 && blocked.length === 0 && skipped.length === 0 &&
  Boolean(tail.deploy && tail.deploy.skipped) && Boolean(tail.verify && tail.verify.skipped)
if (ranNothing) log('the ledger was empty and both tail steps skipped — nothing ran, so nothing is verified')

return {
  result: tailStop ? 'TAIL_RED' : ranNothing ? 'NOTHING_TO_RUN' : blocked.length || skipped.length ? 'PARTIAL' : 'PASS',
  done,
  blocked,
  skipped,
  deploy: tail.deploy,
  verify: tail.verify,
  lessons,
  unsquashed: squashFailures,
  reconciled: corrections,
  stopped: tailStop,
}
