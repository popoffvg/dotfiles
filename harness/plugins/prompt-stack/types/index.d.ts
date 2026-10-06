export type StackEntry = { file: string; preview: string }
export type MenuView = 'menu' | 'list'

declare module 'claude-code' {
  interface PluginState {
    'prompt-stack': {
      draft: string | null
      view: MenuView
      entries: StackEntry[]
    }
  }
}
