import type { CommandInfo, Register } from 'claude-code'

const SUGGESTION_LIMIT = 30
const SKILL_MENTION = /(?:^|\s)\$([\w:.-]+)/g

const isSkill = (c: CommandInfo) => c.source === 'user' || c.source === 'plugin'

const matchRank = (name: string, query: string): number => {
  const n = name.toLowerCase()
  if (n.startsWith(query)) return 0
  if (n.split(/[:\-_.]/).some(part => part.startsWith(query))) return 1
  if (n.includes(query)) return 2
  return -1
}

export const register: Register = on => {
  const hiddenCommands = new Set<string>()

  on('command.describe', async ($, e, next) => {
    const shown = await next(e)
    if (shown.isHidden) hiddenCommands.add(e.command)
    else hiddenCommands.delete(e.command)
    return shown
  })

  on('prompt.autocomplete', { token: /^\$/ }, async ($, e, next) => {
    const query = e.token.slice(1).toLowerCase()
    const skills = (await $.command.list()).filter(c => isSkill(c) && !hiddenCommands.has(c.name))
    const rows = skills
      .map(c => ({ c, rank: matchRank(c.name, query) }))
      .filter(x => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name))
      .slice(0, SUGGESTION_LIMIT)
      .map(({ c }) => ({ text: `$${c.name}`, label: c.name, description: c.description }))
    const { suggestions } = await next(e)
    return { suggestions: [...suggestions, ...rows] }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const typed = new Set([...e.text.matchAll(SKILL_MENTION)].map(m => m[1]))
    if (typed.size === 0) return next(e)
    const known = new Set((await $.command.list()).filter(isSkill).map(c => c.name))
    const named = [...typed].filter(name => known.has(name))
    if (named.length === 0) return next(e)
    const list = named.map(name => `\`${name}\``).join(', ')
    const note = `The user named these skills with $: ${list}. Call the Skill tool for each one before any other action.`
    return next({ ...e, context: [...(e.context ?? []), note] })
  })
}
