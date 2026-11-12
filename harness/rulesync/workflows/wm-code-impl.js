export const meta = {
  name: 'wm-code-impl',
  description: 'Run the reviewrules review until it is green — over one wm TODO it implements first, or over a diff no TODO pair covers',
  whenToUse: "Driving /code impl deterministically, or a fixup loop over a diff no TODO pair covers. In todo mode sonnet implements + commits first; in diff mode the code already exists and the run starts at the review. Each round refreshes the ADR rules and runs reviewrules once over the diff (review:references/ref-reviewrules.md); exit 0 is green, exit 1 routes every FAIL to one wm:implementer fixup and runs the review again, exit 2 stops the run. wm-code-auto calls this once per TODO.",
  phases: [
    { title: 'Intent', detail: 'diff mode only — resolve the base and derive the intent sentence', model: 'haiku' },
    { title: 'Implement', detail: 'wm:implementer (sonnet, opus for a red TODO) writes + commits, and fixes every FAIL of the review', model: 'sonnet' },
    { title: 'Review', detail: 'wm-constraints.py --reviewrules, then one reviewrules run; the exit code decides', model: 'haiku' },
  ],
}


// ── args ─────────────────────────────────────────────────────────────────────
// todo mode: { todo: <N>, risk?: "red" | "yellow" | "green", notesDir?: ".notes", lessonsFile?, maxGateFails? }
// diff mode: { mode: "diff", range?: "HEAD", intent?, notesDir?, lessonsFile?, maxGateFails? }
//
// A slash invocation delivers args as TEXT, not as the object the caller wrote: real runs arrived
// as the bare string "TODO-2" and as the string '{"todo": 2}'. Reading `.todo` off a string yields
// undefined, so an unparsed args is indistinguishable from no args at all — which is how a run
// meant for TODO-2 silently became a review pass over the last commit, implementing nothing. Parse
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
// review run over whatever the last commit happened to be, with no implementation at all.
const mode = parsed.mode || (hasTodo ? 'todo' : null)
if (mode !== 'todo' && mode !== 'diff') {
  throw new Error('Name the work: { todo: <N> } to implement one TODO and review it, or { mode: "diff", range } to review code that already exists.')
}
if (mode === 'todo' && !hasTodo) {
  throw new Error('todo mode needs args { todo: <N> } — which TODO to implement. Pass { mode: "diff" } to review a diff instead.')
}
const todoPath = mode === 'todo' ? `${notesDir}/todos/TODO-${todo}.md` : null

// review:sub-diff.md step 1 — the caller names the range; nothing named means the working tree.
// In todo mode the first Review step resolves the base: the parent of the TODO's first commit.
let range = parsed.range || (mode === 'todo' ? null : 'worktree')
let intent = parsed.intent || null
// The reviewrules inputs (review:references/ref-reviewrules.md § Run it). The Intent step sets them
// in diff mode; in todo mode the target is fixed and the first Review step finds the base.
let base = null
let worktree = false
let target = mode === 'todo' ? `TODO-${todo}` : null

// Set by wm-code-auto to the lessons file every round must read before it edits.
const lessonsFile = parsed.lessonsFile || null

// null = unbounded-until-green, the standalone `/code impl` contract. wm-code-auto
// passes 3 — the third red review run → status: blocked.
const maxGateFails = parsed.maxGateFails || null

const implementerModel = parsed.risk === 'red' ? 'opus' : 'sonnet'

// Backstop only, for the unbounded case: real termination is the review budget or the
// implementer's own hard-stop returning status:"blocked". Logged if ever hit
// (never a silent truncation).
const MAX_ROUNDS = 20


// ── schemas ──────────────────────────────────────────────────────────────────
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
  required: ['range', 'base', 'worktree', 'target', 'intent', 'empty'],
  properties: {
    range: { type: 'string', description: 'the resolved revision range, verbatim' },
    base: { type: 'string', description: 'the --base value: the revision the diff starts from' },
    worktree: { type: 'boolean', description: 'true when the head is the uncommitted working tree' },
    target: { type: 'string', description: 'the slug of the range: the branch name, the short sha, pr-<n>, or worktree' },
    intent: { type: 'string', description: 'one sentence: what this change is for' },
    empty: { type: 'boolean', description: 'true when the range holds no change' },
  },
}
const FAILED_RULE = {
  type: 'object',
  additionalProperties: false,
  required: ['rule', 'severity', 'findings'],
  properties: {
    rule: { type: 'string', description: 'the rule id of a FAIL line of report.md, verbatim; hypothesis/<id> for a CONFIRMED line' },
    severity: { type: 'string', description: 'the severity on that line, verbatim' },
    findings: { type: 'array', items: { type: 'string' }, description: 'each finding under that FAIL line, verbatim' },
  },
}
const REVIEW = {
  type: 'object',
  additionalProperties: false,
  required: ['exit', 'base', 'failed', 'log'],
  properties: {
    exit: { type: 'integer', description: 'the exit code of reviewrules' },
    base: { type: 'string', description: 'the --base value passed, verbatim' },
    failed: { type: 'array', items: FAILED_RULE, description: 'every FAIL line of report.md, the low ones included, and every CONFIRMED hypothesis line; empty when none' },
    log: { type: 'string', description: 'the last 20 lines of reviewrules.log on exit 2; empty otherwise' },
  },
}

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

// A wm diff can carry two kinds of file: source, and the notes corpus the source was written from.
// A real run spent findings on the identifiers quoted inside `todos/TODO-5.md`, and the implementer
// edited the approved spec to close them — the one file a fixup must never touch.
const scopeClause =
  `SCOPE: fix SOURCE files only. Everything under ${notesDir}/ — the spec, the TODO pair, the ` +
  `glossary, the ADRs — is the INPUT the code is judged against. Edit no file there: a finding on ` +
  `one is a spec bug for a human, so leave it and name it in your summary. `

// Diff mode has no TODO to implement, so a correction round is a correction and nothing more: fix
// exactly what the review reported and add no behaviour, because no pair approved any.
function implPrompt(failures) {
  const brief =
    lessonsClause +
    safetyClause +
    (mode === 'todo'
      ? `Implement exactly one TODO: ${todoPath} (notes-dir ${notesDir}). ` +
        `Follow ${PLUGIN}/skills/impl/commands/sub-impl.md steps 1-4, 6, 7 (read context, dependency gate, ` +
        `replan guard, every increment in order, glossary, autotest) as if the resolved approve key were ` +
        `"none": the increment review (step 5.2), the show + approval loop (steps 5.3-5.4), and the TODO review do not run — ` +
        `nobody is watching, and this workflow runs the review itself once the TODO is committed. ` +
        `Both ## Autotest commands green before committing. `
      : `Correct the code already in ${range} (notes-dir ${notesDir}) — no TODO pair covers it, its ` +
        `intent is: ${intent}. Close the findings below and change nothing else: add no behaviour, ` +
        `widen no scope. Leave the tests that cover the changed files green. `) +
    `Commit per ${PLUGIN}/skills/impl/commands/sub-commit.md. ` +
    `Return status:"done" once green + committed, or status:"blocked" with the blocker if you hit a hard-stop ` +
    `(3+ edits without green, 2 failed fix attempts, tool/permission error, or a request to replan).`
  if (!failures || failures.length === 0) return brief
  return (
    `${brief}\n\n${scopeClause}CORRECTION round — the review failed. Address these failures, then commit a FIXUP ` +
    `(git commit --fixup=<sha-being-corrected>), never a plain commit. A failure marked optional is a nit: ` +
    `fix it only when the fix is one line:\n` +
    failures.map((f) => `- ${f}`).join('\n')
  )
}

// ── the review ───────────────────────────────────────────────────────────────
// One reviewrules run per round (review:references/ref-reviewrules.md). The ADR rules are written
// again first, so a Property added mid-run binds the next round.
async function runReview() {
  phase('Review')
  const reportDir = `${notesDir}/review/${target}`
  const baseStep =
    base === null
      ? `First find the base: the parent of the first TODO-${todo} commit, found with git log --oneline. Use it as <base>.\n`
      : ''
  const out = await agent(
    safetyClause +
      `Run one reviewrules review. Change no source file, commit nothing.\n` +
      baseStep +
      `1. When ${notesDir}/adr/ exists, run: ~/.claude/scripts/wm-constraints.py ${notesDir}/adr --reviewrules\n` +
      `2. Run: mkdir -p ${reportDir}\n` +
      `3. Run in the background, and wait for it to exit:\n` +
      `reviewrules --repo "$(git rev-parse --show-toplevel)" --base ${base === null ? '<base>' : base}` +
      (worktree ? ' --worktree' : '') +
      ` --json-out ${reportDir}/reviewrules.json > ${reportDir}/report.md 2> ${reportDir}/reviewrules.log\n` +
      `4. Read ${reportDir}/report.md. Return the exit code, the --base value you passed, every FAIL line ` +
      `(the rule id, the severity, and each finding under it, verbatim), every CONFIRMED hypothesis line as rule hypothesis/<id> with severity high and the lines under it as findings, and on exit 2 the last 20 lines of ${reportDir}/reviewrules.log.`,
    { agentType: 'general-purpose', model: 'haiku', phase: 'Review', schema: REVIEW, label: `review:r${round}` },
  )
  if (out && base === null) base = out.base
  return out
}

// A `low` FAIL is a nit: it does not fail the run, and the fixup brief marks it optional.
function findingLines(failed) {
  return failed.flatMap((f) => {
    const tag = f.severity === 'low' ? `[${f.rule}, optional]` : `[${f.rule}]`
    return (f.findings.length > 0 ? f.findings : ['(no finding text)']).map((x) => `${tag} ${x}`)
  })
}

// Two rules can flip a name back and forth forever, and neither can see the other: one judged an
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

// ── loop ─────────────────────────────────────────────────────────────────────
let round = 0
let redRuns = 0
const history = []

function blocked(stage, impl) {
  return { result: 'BLOCKED', mode, todo, stage, blocker: impl ? impl.blocker : 'implementer agent died', round, history }
}

let impl = null
if (mode === 'todo') {
  phase('Implement')
  // Only the operator sets an ADR to approved; no TODO is implemented while a live ADR is not.
  const approval = await agent(
    `Run exactly: ~/.claude/scripts/wm-constraints.py ${notesDir}/adr --unapproved\n` +
      `Return its exit code and its whole stdout. Change no file, commit nothing, never edit an ADR.`,
    {
      agentType: 'general-purpose',
      model: 'haiku',
      phase: 'Implement',
      label: `adr-approval:TODO-${todo}`,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['exit', 'stdout'],
        properties: { exit: { type: 'integer' }, stdout: { type: 'string' } },
      },
    },
  )
  if (!approval) return blocked('adr-approval', { blocker: 'the ADR approval check agent died' })
  if (approval.exit !== 0) {
    return blocked('adr-approval', {
      blocker: `Every live ADR needs status: approved, set by the operator, before TODO-${todo} is implemented.\n${approval.stdout.trim()}`,
    })
  }
  impl = await agent(implPrompt(), { agentType: 'wm:implementer', model: implementerModel, phase: 'Implement', schema: IMPL, label: `impl:TODO-${todo}` })
  if (!impl || impl.status === 'blocked') return blocked('initial', impl)
} else {
  // review:sub-diff.md step 1 — resolve the target into a base and a head, and derive the intent,
  // because a fixup has nothing approved to work against without it.
  phase('Intent')
  const resolved = await agent(
    `Resolve a review target and report it. Change no file, commit nothing.\n` +
      `1. Resolve "${range}" per the table of review:sub-diff.md step 1 — "worktree" means the uncommitted ` +
      `working tree: base HEAD, worktree true, target worktree. "last" means base HEAD~1. A branch means base ` +
      `the default branch, with the branch checked out. A sha or a range a..b means base a, with b checked out ` +
      `when it is not HEAD. A PR url or number means base the PR base, after gh pr checkout <n>. ` +
      `Return base as a full sha (git rev-parse), so a fixup commit on top does not move it.\n` +
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
  // The review reads the base the Intent agent resolved, not the shorthand the caller typed.
  range = resolved.range
  base = resolved.base
  worktree = resolved.worktree
  target = resolved.target
  intent = resolved.intent
  log(`range ${resolved.range} (base ${base}${worktree ? ', worktree' : ''}) — intent: ${intent}`)
}

while (round < MAX_ROUNDS) {
  round++
  const review = await runReview()
  if (!review) return { result: 'ERROR', mode, todo, stage: 'review', round, history }
  const report = `${notesDir}/review/${target}/report.md`
  const nits = findingLines(review.failed.filter((f) => f.severity === 'low'))

  if (review.exit === 2) {
    log(`round ${round}: reviewrules did not finish — ${review.log.trim()}`)
    return { result: 'ERROR', mode, todo, stage: 'reviewrules', blocker: `reviewrules exit 2; see ${notesDir}/review/${target}/reviewrules.log\n${review.log.trim()}`, round, history }
  }
  if (review.exit === 0) {
    history.push({ round, gate: 'reviewrules', result: 'PASS', failures: nits })
    log(`${mode === 'todo' ? `TODO-${todo}` : range} green after ${round} review run(s) — ${report}`)
    return { result: 'PASS', mode, todo, range: mode === 'diff' ? range : undefined, intent, round, summary: impl ? impl.summary : undefined, report, nits, history }
  }
  if (review.exit !== 1) return { result: 'ERROR', mode, todo, stage: 'reviewrules', blocker: `reviewrules exit ${review.exit}`, round, history }

  for (const f of review.failed) history.push({ round, gate: f.rule, result: 'FAIL', failures: findingLines([f]) })
  redRuns += 1

  // Before spending another implementation round: is this round undoing an earlier one? A reversal
  // means two rules disagree, and no number of further rounds can settle that — each one
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
        `Two rules are reversing each other on ${flip.first.from} / ${flip.first.to}, so every ` +
        `further round is churn. A human decides which rule wins.\n` +
        `- ${flip.first.gate} (round ${flip.first.round}): ${flip.first.finding}\n` +
        `- ${flip.second.gate} (round ${flip.second.round}): ${flip.second.finding}`,
      round,
      history,
    }
  }

  const failures = findingLines(review.failed)
  const ruleIds = review.failed.map((f) => f.rule).join('+') || 'hypothesis'
  log(`round ${round}: review FAIL on ${ruleIds} (${failures.length} findings, ${redRuns}/${maxGateFails || '∞'}) → implementer fixup`)

  if (maxGateFails && redRuns >= maxGateFails) {
    return {
      result: 'BLOCKED',
      mode,
      todo,
      stage: 'reviewrules',
      blocker: `the review was red on ${redRuns} runs; last report ${report}; last findings: ${failures.join(' | ') || '(none reported)'}`,
      round,
      history,
    }
  }

  phase('Implement')
  impl = await agent(implPrompt(failures.length > 0 ? failures : [`read ${report} and close every FAIL in it`]), { agentType: 'wm:implementer', model: implementerModel, phase: 'Implement', schema: IMPL, label: `fixup:r${round}` })
  if (!impl || impl.status === 'blocked') return blocked('review-fixup', impl)
}

log(`${mode === 'todo' ? `TODO-${todo}` : range}: hit MAX_ROUNDS=${MAX_ROUNDS} without a green review — stopping (backstop, not a silent truncation)`)
return { result: 'MAX_ROUNDS', mode, todo, round, history }
