import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Plugin } from "@opencode/plugin";
import { PinUpdate, SessionPins, validatePinUrl } from "./pin-ledger";
import { fetchPinPrStatus, PinPrPattern, type PinPrStatus } from "./pin-pr-status";
import { SessionPinRpc, type PinView } from "./pin-rpc";
import { registerSessionChat } from "./session-chat-server";

const runCommand = promisify(execFile);

export default Plugin.define({
  id: "session-pins",
  async setup(context) {
    await registerSessionChat(context);
    const pins = new SessionPins(context.storage);
    const statuses = new Map<string, PinPrStatus>();
    const pending = new Map<string, Promise<PinView>>();
    const failures = new Map<string, string[]>();
    const view = async (sessionID: string): Promise<PinView> => {
      const current = [...await pins.list(sessionID)];
      return {
        pins: current,
        statuses: Object.fromEntries(current.flatMap(pin => {
          const status = statuses.get(pin.url);
          return status ? [[pin.url, status]] : [];
        })),
        errors: failures.get(sessionID) ?? [],
      };
    };
    const refresh = async (sessionID: string): Promise<PinView> => {
      const active = pending.get(sessionID);
      if (active) return active;
      const update = (async () => {
        const errors: string[] = [];
        for (const pin of await pins.list(sessionID)) {
          if (!PinPrPattern.test(pin.url)) continue;
          try {
            statuses.set(pin.url, await fetchPinPrStatus(pin.url));
          } catch (error) {
            errors.push(`PR status failed for ${pin.title}: ${String(error)}`);
          }
        }
        failures.set(sessionID, errors);
        await registration.events.emit("updated", { sessionID });
        return view(sessionID);
      })();
      pending.set(sessionID, update);
      try {
        return await update;
      } finally {
        pending.delete(sessionID);
      }
    };
    const registration = await context.rpc.register(SessionPinRpc, {
      list: ({ sessionID }) => view(sessionID),
      refresh: ({ sessionID }) => refresh(sessionID),
      open: async ({ sessionID, url }) => {
        if (!(await pins.list(sessionID)).some(pin => pin.url === url)) throw new Error("Pin open requires a link in this session.");
        const target = validatePinUrl(url);
        if (target.protocol === "file:") {
          await runCommand(`${homedir()}/.claude/scripts/open-file.sh`, [fileURLToPath(target)], { timeout: 20_000 });
        } else {
          await runCommand(process.platform === "darwin" ? "open" : "xdg-open", [url], { timeout: 20_000 });
        }
        return null;
      },
    });
    await context.tool.transform(editor => {
      editor.add({
        name: "pin_link",
        description: "Pin a new URL or local file for this session. Supply every pinned URL in order of usefulness. Keep existing pins. Use a file URL for an absolute local path.",
        input: PinUpdate,
        options: { pinned: true },
        execute: async (input, call) => {
          const ranked = await pins.pin(call.sessionID, input);
          await registration.events.emit("updated", { sessionID: call.sessionID });
          void refresh(call.sessionID).catch(() => {});
          return { content: JSON.stringify(ranked) };
        },
      });
    });
    await context.session.hook("context", async event => {
      event.system.push({ type: "text", text: "Use pin_link when a new relevant URL, PR, issue, document, artifact, or local file enters this session. Check the current pins below before adding a link. Rank every pin by usefulness for the current task." });
      const current = await pins.list(event.sessionID);
      event.system.push({ type: "text", text: `Current session pins: ${JSON.stringify(current)}` });
    });
  },
});
