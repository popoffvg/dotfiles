import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  MODE_SCOPE_EVENTS,
  type ModeName,
  type ModeScopeGetPayload,
  type ModeScopeSetPayload,
  type ModeScopeState,
} from "./events";

type ProviderModeMap = Partial<Record<ModeName, string>>;
type ModeConfig = Record<string, ProviderModeMap>;

interface ModeState {
  activeMode: ModeName;
  // null = auto (all providers from config order)
  providerOrder: string[] | null;
}

const CONFIG_FILE = join(__dirname, "modes.json");
const STATE_FILE = join(homedir(), ".pi", "agent", "mode-scope.state.json");

const DEFAULT_CONFIG: ModeConfig = {
  "provider-a": {
    light: "model-light",
    medium: "model-medium",
    heavy: "model-heavy",
  },
  "provider-b": {
    light: "model-light",
    medium: "model-medium",
    heavy: "model-heavy",
  },
};

const DEFAULT_STATE: ModeState = { activeMode: "medium", providerOrder: null };

function ensureConfig(): void {
  if (existsSync(CONFIG_FILE)) return;
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
}

function normalizeConfig(raw: any): ModeConfig {
  const out: ModeConfig = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_CONFIG;

  // Backward compatibility: { modes: { light:[{provider,model}], ... } }
  if (raw.modes && typeof raw.modes === "object") {
    for (const mode of ["light", "medium", "heavy"] as const) {
      const arr = raw.modes[mode];
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        const provider = entry?.provider;
        const model = entry?.model;
        if (typeof provider !== "string" || !provider.trim()) continue;
        if (typeof model !== "string" || !model.trim()) continue;
        if (!out[provider]) out[provider] = {};
        out[provider][mode] = model.trim();
      }
    }
    return Object.keys(out).length > 0 ? out : DEFAULT_CONFIG;
  }

  // Provider-first structure: { provider: { light, medium, heavy } }
  for (const [provider, cfg] of Object.entries(raw)) {
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) continue;
    const m: ProviderModeMap = {};
    if (typeof (cfg as any).light === "string") m.light = (cfg as any).light;
    if (typeof (cfg as any).medium === "string") m.medium = (cfg as any).medium;
    if (typeof (cfg as any).heavy === "string") m.heavy = (cfg as any).heavy;
    out[provider] = m;
  }

  return Object.keys(out).length > 0 ? out : DEFAULT_CONFIG;
}

function loadConfig(): ModeConfig {
  ensureConfig();
  try {
    return normalizeConfig(JSON.parse(readFileSync(CONFIG_FILE, "utf8")));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadState(): ModeState {
  if (!existsSync(STATE_FILE)) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    const activeMode: ModeName =
      parsed?.activeMode === "light" || parsed?.activeMode === "medium" || parsed?.activeMode === "heavy"
        ? parsed.activeMode
        : DEFAULT_STATE.activeMode;

    const providerOrder = Array.isArray(parsed?.providerOrder)
      ? parsed.providerOrder.filter((p: unknown) => typeof p === "string" && p.trim()).map((p: string) => p.trim())
      : null;

    return { activeMode, providerOrder: providerOrder && providerOrder.length > 0 ? providerOrder : null };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: ModeState): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function candidatesForMode(config: ModeConfig, mode: ModeName, providerOrder: string[] | null): Array<{ provider: string; model: string }> {
  const out: Array<{ provider: string; model: string }> = [];
  const entries = Object.entries(config);

  const orderedProviders = providerOrder && providerOrder.length > 0
    ? [
        ...providerOrder,
        ...entries.map(([p]) => p).filter((p) => !providerOrder.includes(p)),
      ]
    : entries.map(([p]) => p);

  for (const provider of orderedProviders) {
    const modeMap = config[provider];
    const model = modeMap?.[mode];
    if (typeof model === "string" && model.trim()) {
      out.push({ provider, model: model.trim() });
    }
  }
  return out;
}

function modeCandidatesText(config: ModeConfig, mode: ModeName, providerOrder: string[] | null): string {
  const cands = candidatesForMode(config, mode, providerOrder);
  return cands.map((c) => `${c.provider}/${c.model}`).join(", ") || "(none)";
}

export default function (pi: ExtensionAPI) {
  let config = loadConfig();
  let state = loadState();
  let lastApplied = "";
  let appliedModel = "no-match";

  function currentState(): ModeScopeState {
    return {
      activeMode: state.activeMode,
      providerOrder: state.providerOrder,
      appliedModel,
    };
  }

  function emitChanged(reason: string): void {
    pi.events.emit(MODE_SCOPE_EVENTS.CHANGED, {
      ...currentState(),
      reason,
    });
  }

  async function applyMode(ctx: ExtensionContext): Promise<string> {
    const candidates = candidatesForMode(config, state.activeMode, state.providerOrder);

    for (const c of candidates) {
      const model = ctx.modelRegistry.find(c.provider, c.model);
      if (!model) continue;

      const key = `${state.activeMode}:${c.provider}/${c.model}`;
      if (lastApplied !== key) {
        await pi.setModel(model);
        lastApplied = key;
      }

      const applied = `${c.provider}/${c.model}`;
      appliedModel = applied;
      if (ctx.hasUI) ctx.ui.setStatus("mode-scope", `🧭 ${state.activeMode} · ${applied}`);
      return applied;
    }

    appliedModel = "no-match";
    if (ctx.hasUI) ctx.ui.setStatus("mode-scope", `🧭 ${state.activeMode} · no-match`);
    return "no-match";
  }

  pi.on("session_start", async (_event, ctx) => {
    config = loadConfig();
    state = loadState();
    await applyMode(ctx);
    emitChanged("session_start");
  });

  // Enforce mode before every agent run.
  pi.on("before_agent_start", async (_event, ctx) => {
    await applyMode(ctx);
  });

  // Event API for other extensions
  pi.events.on(MODE_SCOPE_EVENTS.GET, (payload: ModeScopeGetPayload) => {
    payload.resolve(currentState());
  });

  pi.events.on(MODE_SCOPE_EVENTS.SET, async (payload: ModeScopeSetPayload) => {
    let changed = false;

    if (payload.mode && (payload.mode === "light" || payload.mode === "medium" || payload.mode === "heavy")) {
      state.activeMode = payload.mode;
      changed = true;
    }

    if (payload.providerOrder !== undefined) {
      const known = new Set(Object.keys(config));
      const filtered = (payload.providerOrder || [])
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => p.trim())
        .filter((p) => known.has(p));
      state.providerOrder = filtered.length > 0 ? filtered : null;
      changed = true;
    }

    if (changed) {
      saveState(state);
      emitChanged(payload.reason || "event_set");
    }

    payload.resolve?.(currentState());
  });

  pi.registerCommand("mode-provider", {
    description: "Show or set provider scope/order: /mode-provider [auto|reload|p1[,p2...]]",
    handler: async (args, ctx) => {
      const cmd = (args || "").trim();

      if (!cmd) {
        const providers = Object.keys(config);
        const lines = [
          `Provider scope: ${state.providerOrder && state.providerOrder.length > 0 ? state.providerOrder.join(", ") : "auto"}`,
          `Available providers: ${providers.join(", ") || "(none)"}`,
          "",
          "Usage:",
          "  /mode-provider auto",
          "  /mode-provider reload",
          "  /mode-provider <provider>",
          "  /mode-provider <provider1>,<provider2>",
        ];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      const lower = cmd.toLowerCase();
      if (lower === "reload") {
        config = loadConfig();
        const applied = await applyMode(ctx);
        emitChanged("mode-provider:reload");
        ctx.ui.notify(`Reloaded providers. Applied: ${applied}`, "info");
        return;
      }

      if (lower === "auto") {
        state.providerOrder = null;
        saveState(state);
        const applied = await applyMode(ctx);
        emitChanged("mode-provider:auto");
        ctx.ui.notify(`Provider scope set to auto. Applied: ${applied}`, "success");
        return;
      }

      const requested = cmd.split(",").map((s) => s.trim()).filter(Boolean);
      if (requested.length === 0) {
        ctx.ui.notify("Usage: /mode-provider [auto|reload|p1[,p2...]]", "error");
        return;
      }

      const known = new Set(Object.keys(config));
      const unknown = requested.filter((p) => !known.has(p));
      if (unknown.length > 0) {
        ctx.ui.notify(`Unknown provider(s): ${unknown.join(", ")}. Available: ${[...known].join(", ")}`, "error");
        return;
      }

      state.providerOrder = requested;
      saveState(state);
      const applied = await applyMode(ctx);
      emitChanged("mode-provider:set");
      ctx.ui.notify(`Provider scope set to: ${requested.join(", ")}. Applied: ${applied}`, "success");
    },
  });

  pi.registerCommand("mode", {
    description: "Show or set model mode: /mode [light|medium|heavy|reload]",
    handler: async (args, ctx) => {
      const cmd = (args || "").trim().toLowerCase();

      if (!cmd) {
        const lines = [
          `Active mode: ${state.activeMode}`,
          `Provider scope: ${state.providerOrder && state.providerOrder.length > 0 ? state.providerOrder.join(", ") : "auto"}`,
          `Current candidates: ${modeCandidatesText(config, state.activeMode, state.providerOrder)}`,
          "",
          `light:  ${modeCandidatesText(config, "light", state.providerOrder)}`,
          `medium: ${modeCandidatesText(config, "medium", state.providerOrder)}`,
          `heavy:  ${modeCandidatesText(config, "heavy", state.providerOrder)}`,
          "",
          `Config file: ${CONFIG_FILE}`,
          `State file: ${STATE_FILE}`,
        ];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      if (cmd === "reload") {
        config = loadConfig();
        const applied = await applyMode(ctx);
        emitChanged("mode:reload");
        ctx.ui.notify(`Reloaded config. Active mode ${state.activeMode} -> ${applied}`, "info");
        return;
      }

      if (cmd !== "light" && cmd !== "medium" && cmd !== "heavy") {
        ctx.ui.notify("Usage: /mode [light|medium|heavy|reload]", "error");
        return;
      }

      state.activeMode = cmd;
      saveState(state);
      const applied = await applyMode(ctx);
      emitChanged("mode:set");
      ctx.ui.notify(`Mode set to ${cmd}. Applied: ${applied}`, "success");
    },
  });
}
