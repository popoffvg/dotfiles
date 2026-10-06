import { expect, test } from 'claude-code/testing'

import { modelFromAnswer, modelOptions, parseModelAnswer } from './register'

const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const composer = { kind: 'composer' } as const

test('parseModelAnswer reads only a known model name', () => {
  expect(parseModelAnswer(' Opus.')).toBe('opus')
  expect(parseModelAnswer('gpt')).toBe(undefined)
})

test('modelOptions puts the suggestion first and the session model last', () => {
  expect(modelOptions('sonnet', 'opus[1m]')).toEqual(['sonnet (Recommended)', 'haiku', 'opus', 'Keep opus[1m]'])
  expect(modelFromAnswer('sonnet (Recommended)')).toBe('sonnet')
  expect(modelFromAnswer('Keep opus[1m]')).toBe(undefined)
})

test('the first prompt runs on the model the user chose', async ($, on) => {
  on('model.complete', () => ({ value: { isAnswered: true, text: 'sonnet', usage } }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => ({
    result: { questions: e.questions, answers: { [e.questions[0].question]: 'opus' } },
  }))
  on('session.turns', () => ({ value: 0 }))
  on('session.model', () => ({ value: 'claude-default' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const models: string[] = []
  on('turn.step', async function* (_, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.prompt.submit({ text: 'design a new cache layer', origin: composer })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-default', messageCount: 1 })) {
  }

  expect(models).toEqual(['opus'])
})

test('a dismissed dialog keeps the session model', async ($, on) => {
  on('model.complete', () => ({ value: { isAnswered: true, text: 'haiku', usage } }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'dismissed' }))
  on('session.turns', () => ({ value: 0 }))
  on('session.model', () => ({ value: 'claude-default' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const models: string[] = []
  on('turn.step', async function* (_, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.prompt.submit({ text: 'rename foo', origin: composer })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-default', messageCount: 1 })) {
  }

  expect(models).toEqual(['claude-default'])
})
