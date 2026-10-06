import { expect, test } from 'claude-code/testing'

const typed = (text: string, inputText: string) => ({
  origin: { kind: 'composer' as const },
  text,
  cursor: text.length,
  start: text.length,
  end: text.length,
  inputText,
})

test('the menu trigger clears the box', async $ => {
  const box = await $.prompt.edit(typed('fix the parser', '\u{E000}'))

  expect(box.text).toBe('')
})

test('a key outside the menu restores the draft with that key', async $ => {
  await $.prompt.edit(typed('fix the parser', '\u{E000}'))
  const box = await $.prompt.edit(typed('', '!'))

  expect(box.text).toBe('fix the parser!')
})

test('the trigger again restores the draft', async $ => {
  await $.prompt.edit(typed('fix the parser', '\u{E000}'))
  const box = await $.prompt.edit(typed('', '\u{E000}'))

  expect(box.text).toBe('fix the parser')
})

test('other typed text passes through', async ($, on) => {
  on('prompt.edit', (_, e) => ({ text: e.text + e.inputText, cursor: e.cursor + e.inputText.length }))

  const box = await $.prompt.edit(typed('fix', ' it'))

  expect(box.text).toBe('fix it')
})
