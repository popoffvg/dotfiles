import type { Register } from 'claude-code'

export const register: Register = on => {
  on('command.run', { command: 'clear' }, async ($, e, next) => {
    const isZed = (await $.env.get('ZED_TERM')) === 'true' || (await $.env.get('TERM_PROGRAM')) === 'zed'
    return isZed ? { text: 'zed-clear-guard: /clear is blocked in a Zed terminal. Start a new Zed agent thread.' } : next(e)
  })
}
