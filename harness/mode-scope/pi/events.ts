export const MODE_SCOPE_EVENTS = {
  /** Request current mode/provider state */
  GET: "mode-scope:get",
  /** Set mode and/or provider scope */
  SET: "mode-scope:set",
  /** Emitted whenever mode/provider scope changes */
  CHANGED: "mode-scope:changed",
} as const;

export type ModeName = "light" | "medium" | "heavy";

export interface ModeScopeState {
  activeMode: ModeName;
  providerOrder: string[] | null;
  appliedModel: string;
}

export interface ModeScopeGetPayload {
  resolve: (state: ModeScopeState) => void;
}

export interface ModeScopeSetPayload {
  mode?: ModeName;
  providerOrder?: string[] | null;
  reason?: string;
  resolve?: (state: ModeScopeState) => void;
}
