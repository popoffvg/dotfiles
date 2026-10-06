export type ModelPick = {
  model: string
  sessionModel: string
}

declare module 'claude-code' {
  interface PluginState {
    'first-prompt-model': { pick: ModelPick | null; isDecided: boolean }
  }
}
