import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { MenuView, StackEntry } from '../types'

const MENU_TRIGGER = '\u{E000}'
const PREVIEW_LENGTH = 60
const LIST_LIMIT = 9

const draft = atom({ plugin: 'prompt-stack', key: 'draft' } as const, null)
const view = atom({ plugin: 'prompt-stack', key: 'view' } as const, 'menu')
const entries = atom({ plugin: 'prompt-stack', key: 'entries' } as const, [])

type MenuKey = 'push' | 'pop' | 'list'

const MENU: readonly { key: MenuKey; hotkey: string; label: string }[] = [
  { key: 'push', hotkey: 'u', label: 'push: save the draft on the stack' },
  { key: 'pop', hotkey: 'o', label: 'pop: restore the newest draft' },
  { key: 'list', hotkey: 'l', label: 'list: pick a saved draft' },
]

const firstLine = (text: string): string =>
  (text.split('\n').find(line => line.trim() !== '') ?? '').slice(0, PREVIEW_LENGTH)

const boxWith = (text: string) => ({ text, cursor: text.length })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, draft, () => null)
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const pending = await read($, draft)
    const isTrigger = e.inputText.includes(MENU_TRIGGER)

    if (pending === null) {
      if (!isTrigger) return next(e)
      await update($, draft, () => e.text)
      await update($, view, (): MenuView => 'menu')
      return boxWith('')
    }

    const closeMenu = async (text: string) => {
      await update($, draft, () => null)
      return boxWith(text)
    }

    if (isTrigger) return closeMenu(pending)

    const stackDir = async () => `${await $.env.get('HOME')}/.claude/prompt-stack`

    const loadEntries = async (): Promise<StackEntry[]> => {
      const dir = await stackDir()
      if (!(await $.fs.exists(dir))) return []
      const names = (await $.fs.list(dir))
        .filter(entry => entry.kind === 'file' && entry.name.endsWith('.md'))
        .map(entry => entry.name)
        .sort()
        .reverse()
        .slice(0, LIST_LIMIT)
      return Promise.all(
        names.map(async name => {
          const file = `${dir}/${name}`
          return { file, preview: firstLine(await $.fs.read(file)) }
        }),
      )
    }

    const restoreEntry = async (file: string) => {
      const saved = await $.fs.read(file)
      await $.process.run(['rm', '-f', file])
      return closeMenu(pending === '' ? saved : `${saved}\n\n${pending}`)
    }

    if ((await read($, view)) === 'list') {
      const picked = (await read($, entries))[Number(e.inputText) - 1]
      return picked === undefined ? closeMenu(pending + e.inputText) : restoreEntry(picked.file)
    }

    const runMenu: Record<MenuKey, () => Promise<{ text: string; cursor: number }>> = {
      push: async () => {
        if (pending.trim() === '') {
          $.ui.toast('prompt-stack: the draft is empty, nothing to push')
          return closeMenu('')
        }
        await $.fs.write(`${await stackDir()}/${await $.clock.now()}.md`, pending)
        $.ui.toast('prompt-stack: draft pushed')
        return closeMenu('')
      },
      pop: async () => {
        const [newest] = await loadEntries()
        if (newest === undefined) {
          $.ui.toast('prompt-stack: the stack is empty')
          return closeMenu(pending)
        }
        return restoreEntry(newest.file)
      },
      list: async () => {
        const loaded = await loadEntries()
        await update($, entries, () => loaded)
        await update($, view, (): MenuView => 'list')
        return boxWith('')
      },
    }

    const item = MENU.find(row => row.hotkey === e.inputText)
    return item === undefined ? closeMenu(pending + e.inputText) : runMenu[item.key]()
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const pending = await read($, draft)
    if (pending === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const cancelHint = <Text dimColor>any other key: close and restore the draft</Text>

    if ((await read($, view)) === 'list') {
      const list = await read($, entries)
      return (
        <Box flexDirection="column">
          {list.length === 0 && <Text dimColor>The stack is empty.</Text>}
          {list.map((entry, index) => (
            <Text>
              {index + 1}: {entry.preview || '(blank draft)'}
            </Text>
          ))}
          {cancelHint}
        </Box>
      )
    }

    const preview = firstLine(pending)
    return (
      <Box flexDirection="column">
        <Text dimColor>Draft: {preview === '' ? '(empty)' : preview}</Text>
        {MENU.map(row => (
          <Text>
            {row.hotkey}  {row.label}
          </Text>
        ))}
        {cancelHint}
      </Box>
    )
  })
}
