export const meta = {
  name: 'mine-capture-cases',
  description: 'Mine real session transcripts for boundary cases to grow capture-lesson evals',
  whenToUse: 'After changing a capture-lesson gate, or periodically, to grow cases.jsonl from real sessions instead of hand-written ones',
  phases: [
    { title: 'Scan', detail: 'find recent transcripts with enough user turns' },
    { title: 'Extract', detail: 'one agent per session: correction / method / decision moments' },
    { title: 'Label', detail: 'apply the gates + argue the opposite; disagreement marks a boundary case' },
    { title: 'Assemble', detail: 'dedup against cases.jsonl, emit review-ready lines' },
  ],
}

// args: { max?: number }  — sessions to mine, newest first. Default 5.
const MAX = (args && args.max) || 5
const SKILL = '~/Documents/git/dotfiles/harness/plugins/self-improvement/skills/capture-lesson/SKILL.md'
const CASES = '~/Documents/git/dotfiles/harness/plugins/self-improvement/evals/cases.jsonl'

phase('Scan')
const scan = await agent(
  `Find candidate session transcripts under ~/.claude/projects/*/. Rules:
   - plain *.jsonl files only; skip agent-*.jsonl and anything under tool-results/
   - for each file count user TEXT messages: JSONL lines where .type=="user",
     (.isMeta//false)==false, and .message.content is a string or contains a
     {"type":"text"} item (tool_result-only lines do not count)
   - keep files with count >= 3 (a lesson needs the user reacting to work)
   - return the ${MAX} most recently modified, as {sessions:[{path, user_msgs}]}`,
  { label: 'scan-transcripts', effort: 'low',
    schema: { type: 'object', required: ['sessions'], properties: { sessions: { type: 'array', items: {
      type: 'object', required: ['path'], properties: { path: { type: 'string' }, user_msgs: { type: 'number' } } } } } } }
)
log(`${scan.sessions.length} sessions to mine (asked for ${MAX})`)

const CANDIDATE_SCHEMA = {
  type: 'object', required: ['candidates'], properties: { candidates: { type: 'array', maxItems: 2, items: {
    type: 'object',
    required: ['utterance', 'context', 'kind'],
    properties: {
      utterance: { type: 'string', description: "the user's words, verbatim, never paraphrased" },
      context: { type: 'string', description: 'what the agent had done or was about to do when the user spoke' },
      kind: { type: 'string', enum: ['correction', 'method', 'decision', 'task-spec'] },
      session: { type: 'string' },
    },
  } } },
}

const LABEL_SCHEMA = {
  type: 'object',
  required: ['source', 'scope', 'form', 'why', 'opposite_argument', 'boundary'],
  properties: {
    source: { type: 'string', enum: ['correction', 'method', 'decision'] },
    scope: { type: 'string', enum: ['global', 'project', 'skip'] },
    form: { type: 'string', enum: ['verdict', 'check'] },
    why: { type: 'string' },
    opposite_argument: { type: 'string', description: 'the strongest honest case for a DIFFERENT scope or form' },
    boundary: { type: 'boolean', description: 'true when the opposite argument is genuinely close — these make the best eval cases' },
  },
}

phase('Extract')
const labeled = await pipeline(
  scan.sessions,
  (s) => agent(
    `Read the session transcript at ${s.path} (JSONL; extract user messages first, e.g.
     jq -r 'select(.type=="user" and ((.isMeta//false)|not)) | .message.content | if type=="string" then . else ([.[]?|select(.type=="text")|.text]|join("\\n")) end' — then read surrounding assistant turns only where needed for context).
     Find moments where the user (a) corrected the agent's work, (b) stated how they
     want work done or how their repo works, or (c) made a pick / gave a task spec.
     Skip pure question-answering and pleasantries. Return at most 2 candidates with
     the user's VERBATIM words and one sentence of surrounding context each; set
     session to the transcript filename. Return {candidates: []} if the session has none.`,
    { label: `extract:${s.path.split('/').pop()}`, phase: 'Extract', schema: CANDIDATE_SCHEMA }
  ),
  (r) => parallel((r?.candidates || []).map((c) => () =>
    agent(
      `Read the gate sections (Step 0 through Step 1b) of ${SKILL}. Apply them literally to this captured moment:
       USER'S WORDS (verbatim): ${JSON.stringify(c.utterance)}
       CONTEXT: ${c.context}
       Give source/scope/form per the gates, then argue the OPPOSITE scope or form as
       strongly as honesty allows. Set boundary=true only if that opposite argument is
       genuinely close — boundary cases are what the eval suite needs most.`,
      { label: `label:${c.kind}`, phase: 'Label', schema: LABEL_SCHEMA }
    ).then((v) => v && { ...c, label: v })
  ))
)

phase('Assemble')
const flat = labeled.filter(Boolean).flat().filter(Boolean)
log(`${flat.length} labeled candidates`)
const review = await agent(
  `Existing eval ids are in ${CASES} (jq -r .id). Below are labeled candidates mined from real sessions:
   ${JSON.stringify(flat, null, 1)}
   1. Drop any candidate that duplicates an existing case's situation (read the existing
      file's descriptions to check), and drop non-boundary duplicates of each other.
   2. Convert survivors to cases.jsonl-ready lines with fields
      {id, scope, form, source, description, anchors, utterance, note} matching the
      existing file's style: description = the situation, anchors = the evidence in the
      reproduction, note = why the label is right and what makes the case discriminating.
   3. Do NOT edit ${CASES}. Write the lines to a sibling file candidates-for-review.jsonl
      in the same directory (overwrite it), and return {written, dropped_duplicates, boundary_count}.`,
  { label: 'assemble-review-file', phase: 'Assemble',
    schema: { type: 'object', required: ['written'], properties: {
      written: { type: 'number' }, dropped_duplicates: { type: 'number' }, boundary_count: { type: 'number' } } } }
)
log(`wrote ${review.written} candidate cases (${review.boundary_count ?? '?'} boundary, ${review.dropped_duplicates ?? 0} dupes dropped) -> evals/candidates-for-review.jsonl`)
return review
