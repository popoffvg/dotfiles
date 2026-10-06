import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ModelPick } from '../types'

const MODEL_CHOICES = [
  { model: 'haiku', use: 'a short question, a lookup, a one-line edit, a rename, a format change' },
  { model: 'sonnet', use: 'ordinary coding: a feature, a bug fix, tests, a refactor in a few files' },
  { model: 'opus', use: 'hard work: architecture, design, a deep debug, a large refactor, research across many files' },
] as const

const RECOMMENDED_SUFFIX = ' (Recommended)'

const pick = atom({ plugin: 'first-prompt-model', key: 'pick' } as const, null)
const isDecided = atom({ plugin: 'first-prompt-model', key: 'isDecided' } as const, false)

const ROUTER_SYSTEM = [
  'You choose the model that will execute a coding-assistant prompt.',
  'Choose the cheapest model that can do the task well.',
  ...MODEL_CHOICES.map(c => `- ${c.model}: ${c.use}`),
  `Answer with one word: ${MODEL_CHOICES.map(c => c.model).join(', ')}.`,
].join('\n')

export function parseModelAnswer(text: string): string | undefined {
  const word = text.trim().toLowerCase().match(/[a-z]+/)?.[0]
  return MODEL_CHOICES.find(c => c.model === word)?.model
}

export function modelOptions(suggested: string, sessionModel: string): string[] {
  const others = MODEL_CHOICES.map(c => c.model).filter(m => m !== suggested)
  return [suggested + RECOMMENDED_SUFFIX, ...others, `Keep ${sessionModel}`]
}

export function modelFromAnswer(answer: string): string | undefined {
  const label = answer.endsWith(RECOMMENDED_SUFFIX) ? answer.slice(0, -RECOMMENDED_SUFFIX.length) : answer
  return MODEL_CHOICES.find(c => c.model === label)?.model
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' || (await read($, isDecided))) {
      return next(e)
    }
    await update($, isDecided, () => true)
    if ((await $.session.turns()) > 0) {
      return next(e)
    }

    $.ui.status('first-prompt-model: Haiku is choosing a model')
    const reply = await $.model.complete({
      model: 'haiku',
      system: ROUTER_SYSTEM,
      prompt: `<prompt>\n${e.text}\n</prompt>`,
      effort: 'low',
      maxTokens: 16,
      timeoutMs: 15000,
    })
    $.ui.status(undefined)
    const suggested = reply.isAnswered ? parseModelAnswer(reply.text) : undefined
    if (suggested === undefined) {
      $.ui.toast('first-prompt-model: Haiku gave no model, the session model stays')
      return next(e)
    }

    const sessionModel = await $.session.model()
    const answer = await $.ui
      .ask('Which model must run this session?', {
        header: 'Model',
        options: modelOptions(suggested, sessionModel),
      })
      .catch(() => '')
    const model = modelFromAnswer(answer)
    if (model === undefined) {
      return next(e)
    }

    const chosen: ModelPick = { model, sessionModel }
    await update($, pick, () => chosen)
    $.ui.status(`model: ${model}`)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const chosen = await read($, pick)
    const isMainLoop = e.agentId === undefined
    const isModelUnchanged = chosen !== null && (await $.session.model()) === chosen.sessionModel
    if (!isMainLoop || !isModelUnchanged) {
      return yield* next(e)
    }
    return yield* next({ ...e, model: chosen.model })
  })
}
