import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SideTurn } from '../types'

const PANE = 'side-chat'
const thread = atom({ plugin: 'side-chat', key: 'thread' } as const, [], { shape: 'thread-1' })
const isWaiting = atom({ plugin: 'side-chat', key: 'isWaiting' } as const, false)

const sidePrompt = (turns: SideTurn[], question: string): string =>
  [
    'This is a side chat, a branch of the conversation above. The main thread does not see it.',
    'You have no tools here: answer from the conversation and your knowledge, directly and briefly.',
    ...turns
      .filter(turn => turn.author !== 'error')
      .map(turn => `${turn.author === 'you' ? 'User' : 'You'} (side chat): ${turn.text}`),
    `User (side chat): ${question}`,
  ].join('\n\n')

const ask = async ($: EngineInterface, question: string) => {
  const text = question.trim()
  if (text === '' || (await read($, isWaiting))) return
  const before = await read($, thread)
  await update($, thread, list => [...list, { author: 'you', text } as SideTurn])
  await update($, isWaiting, () => true)
  try {
    const prompt = sidePrompt(before, text)
    const forked = await $.model.fork({ prompt })
    const reply = !forked.isAnswered && forked.reason === 'nothing-to-fork' ? await $.model.complete({ model: 'sonnet', prompt }) : forked
    const answer: SideTurn = reply.isAnswered
      ? { author: 'claude', text: reply.text }
      : { author: 'error', text: `No reply: ${reply.reason}` }
    await update($, thread, list => [...list, answer])
  } catch (error) {
    await update($, thread, list => [...list, { author: 'error', text: `No reply: ${String(error)}` } as SideTurn])
  } finally {
    await update($, isWaiting, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'side', description: 'Open a side chat with a fork of this conversation; /side <question> asks it' })

    return next(e)
  })

  on('command.run', { command: 'side' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: 'Side chat', focus: true, closeOnEscape: true })
    void ask($, e.args)

    return { text: 'Side chat opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Markdown, Input, Button } = $.ui.resolve(e)
    const turns = await read($, thread)
    const waiting = await read($, isWaiting)
    const lastReply = turns.findLast(turn => turn.author === 'claude')

    return (
      <Box flexDirection="column">
        {turns.length === 0 && <Text dimColor>Ask about the conversation. The main thread does not see this chat.</Text>}
        {turns.map(turn =>
          turn.author === 'you' ? (
            <Text bold>{'> '}{turn.text}</Text>
          ) : turn.author === 'error' ? (
            <Text color="red">{turn.text}</Text>
          ) : (
            <Markdown text={turn.text} />
          ),
        )}
        {waiting && <Text dimColor>Thinking…</Text>}
        <Input key="question" placeholder="Ask the side chat" submitLabel="send" autoFocus rows={3} onSubmit={value => void ask($, value)} />
        <Box>
          <Button key="use" label="Use in prompt" onPress={() => lastReply && $.prompt.fill({ text: lastReply.text, mode: 'append' })} />
          <Text> </Text>
          <Button key="new" label="New" onPress={() => update($, thread, () => [])} />
          <Text> </Text>
          <Button key="close" label="Close" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
