import { expect, mock, test } from 'claude-code/testing'

const composer = { kind: 'composer' } as const

test('/clear is blocked in a Zed terminal', async ($, on) => {
  mock.env(on, { ZED_TERM: 'true' })
  let isCleared = false
  on('command.run', { command: 'clear' }, () => {
    isCleared = true
    return { text: '' }
  })

  const ran = await $.command.run({ command: 'clear', args: '', origin: composer })

  expect(isCleared).toBe(false)
  expect(ran.text).toContain('blocked')
})

test('/clear runs outside Zed', async ($, on) => {
  mock.env(on, { TERM_PROGRAM: 'ghostty' })
  let isCleared = false
  on('command.run', { command: 'clear' }, () => {
    isCleared = true
    return { text: '' }
  })

  await $.command.run({ command: 'clear', args: '', origin: composer })

  expect(isCleared).toBe(true)
})
