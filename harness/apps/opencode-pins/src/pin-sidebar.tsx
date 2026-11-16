import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { Plugin, usePlugin } from "@opencode/plugin/tui";
import type { PanelInput } from "@opencode/plugin/tui/context";
import { SessionPinRpc, type PinView } from "./pin-rpc";
import { showSessionRewind } from "./session-rewind";
import { SideChatPanel } from "./side-chat-panel";
import { SessionChatRpc } from "./session-chat-rpc";

function PinSidebar(props: { panel: PanelInput }) {
  const context = usePlugin();
  const [view, setView] = createSignal<PinView>({ pins: [], statuses: {}, errors: [] });
  const [failure, setFailure] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  let disposed = false;
  let generation = 0;
  const load = async (refresh = false) => {
    const sessionID = props.panel.sessionID;
    const request = ++generation;
    setBusy(true);
    try {
      const rpc = context.client.rpc(SessionPinRpc);
      const next = await (refresh ? rpc.refresh({ sessionID }) : rpc.list({ sessionID }));
      if (!disposed && request === generation && props.panel.sessionID === sessionID) {
        setView(next);
        setFailure("");
      }
    } catch (error) {
      if (!disposed && request === generation) setFailure(String(error));
    } finally {
      if (!disposed && request === generation) setBusy(false);
    }
  };
  const open = async (index: number) => {
    const pin = view().pins[index];
    if (!pin) return;
    try {
      await context.client.rpc(SessionPinRpc).open({ sessionID: props.panel.sessionID, url: pin.url });
    } catch (error) {
      context.ui.toast.show({ message: `Pin open failed: ${String(error)}`, variant: "error" });
    }
  };
  createEffect(on(() => props.panel.sessionID, () => {
    setView({ pins: [], statuses: {}, errors: [] });
    void load(true);
  }));
  const unsubscribe = context.client.rpc(SessionPinRpc).events.on("updated", event => {
    if (event.data.sessionID === props.panel.sessionID) void load();
  });
  const timer = setInterval(() => void load(true), 120_000);
  onCleanup(() => {
    disposed = true;
    clearInterval(timer);
    unsubscribe();
  });
  context.keymap.layer(() => ({
    commands: [
      { bind: "r", enabled: () => props.panel.focused, run: () => load(true) },
      { bind: "escape", enabled: () => props.panel.focused, run: props.panel.close },
      ...Array.from({ length: 9 }, (_, index) => ({
        bind: String(index + 1), enabled: () => props.panel.focused, run: () => open(index),
      })),
    ],
  }));
  return (
    <scrollbox flexGrow={1}>
    <box flexDirection="column" backgroundColor={context.theme.background.raised.base} padding={1} gap={1} onMouseDown={props.panel.focus}>
      <text fg={context.theme.text.base}>{`◆ ${view().pins.length} pinned`}</text>
      <text fg={context.theme.text.muted}>1–9: open · r: refresh · Esc: close</text>
      <Show when={busy()}><text fg={context.theme.text.muted}>Refresh in progress…</text></Show>
      <Show when={failure()}><text fg={context.theme.text.base}>{failure()}</text></Show>
      <For each={view().errors}>{error => <text fg={context.theme.text.base}>{error}</text>}</For>
      <Show when={view().pins.length === 0 && !busy()}><text fg={context.theme.text.muted}>No pinned links yet.</text></Show>
      <For each={view().pins}>{(pin, index) => (
        <box flexDirection="column" border borderColor={context.theme.border.base} paddingX={1} onMouseDown={() => void open(index())}>
          <text fg={context.theme.text.base}>{`${index() + 1}. ${view().statuses[pin.url]?.title || pin.title}`}</text>
          <text fg={context.theme.text.muted}>{pin.url}</text>
          <Show when={view().statuses[pin.url]}>{status => <>
            <text fg={context.theme.text.base}>{status().detail}</text>
            <text fg={context.theme.text.muted}>{`Checked ${new Date(status().checkedAt).toLocaleTimeString()}`}</text>
          </>}</Show>
          <text fg={context.theme.text.base}>{pin.why}</text>
        </box>
      )}</For>
    </box>
    </scrollbox>
  );
}

export default Plugin.define({
  id: "session-pins.tui",
  setup(context) {
    context.ui.slot({
      append: "session.panel",
      render: panel => <>
        <Show when={panel.name === "session-pins"}><PinSidebar panel={panel} /></Show>
        <Show when={panel.name === "session-side-chat"}><SideChatPanel panel={panel} /></Show>
      </>,
    });
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "session-pins.open", title: "Open pins", palette: true, slash: { name: "pins" },
          run: () => { context.ui.panel.open("session-pins"); },
        },
        {
          id: "session-pins.rewind", title: "Rewind conversation and files", palette: true, slash: { name: "rewind" },
          run: async () => {
            try {
              await showSessionRewind(context);
            } catch (error) {
              context.ui.toast.show({ message: `Session rewind failed: ${String(error)}`, variant: "error" });
            }
          },
        },
        {
          id: "session-chat.open", title: "Open side chat", palette: true, slash: { name: "side", arguments: true },
          run: async input => {
            const route = context.ui.router.current();
            if (route.type !== "session") return;
            context.ui.panel.open("session-side-chat");
            if (!input?.trim()) return;
            try {
              await context.client.rpc(SessionChatRpc).ask({ sessionID: route.sessionID, question: input });
            } catch (error) {
              context.ui.toast.show({ message: `Side chat failed: ${String(error)}`, variant: "error" });
            }
          },
        },
      ],
    }));
  },
});
