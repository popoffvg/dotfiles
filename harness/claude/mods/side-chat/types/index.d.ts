export type SideTurn = { author: 'you' | 'claude' | 'error'; text: string }

declare module 'claude-code' {
  interface PluginState {
    'side-chat': { thread: Shaped<SideTurn[]>; isWaiting: boolean }
  }
}
