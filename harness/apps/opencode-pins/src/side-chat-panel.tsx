import { SyntaxStyle, type TextareaRenderable } from "@opentui/core";
import { usePlugin } from "@opencode/plugin/tui";
import type { PanelInput } from "@opencode/plugin/tui/context";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { SessionChatRpc } from "./session-chat-rpc";
import type { SideView } from "./side-chat";

const turnAuthors = {
  you: { label: "You", markdown: false },
  assistant: { label: "Assistant", markdown: true },
  error: { label: "Error", markdown: false },
};

export function SideChatPanel(props: { panel: PanelInput }) {
  const context = usePlugin();
  const [view, setView] = createSignal<SideView>({ turns: [], waiting: false });
  const [failure, setFailure] = createSignal("");
  const style = createMemo(() => {
    const syntax = SyntaxStyle.fromStyles({ default: { fg: context.theme.text.base } }, context.renderer.nativeScene);
    onCleanup(() => { void context.renderer.idle().then(() => syntax.destroy()); });
    return syntax;
  });
  let editor: TextareaRenderable | undefined;
  let disposed = false;
  const load = async () => {
    const sessionID = props.panel.sessionID;
    try {
      const next = await context.client.rpc(SessionChatRpc).list({ sessionID });
      if (!disposed && props.panel.sessionID === sessionID) setView(next);
    } catch (error) {
      if (!disposed) setFailure(String(error));
    }
  };
  createEffect(on(() => props.panel.sessionID, () => {
    setView({ turns: [], waiting: false });
    setFailure("");
    void load();
  }));
  const stop = context.client.rpc(SessionChatRpc).events.on("updated", event => {
    if (event.data.sessionID === props.panel.sessionID) void load();
  });
  onCleanup(() => {
    disposed = true;
    stop();
  });
  const send = async () => {
    const question = editor?.plainText.trim() ?? "";
    if (!question || view().waiting) return;
    const sessionID = props.panel.sessionID;
    setView({ ...view(), waiting: true });
    setFailure("");
    editor?.clear();
    try {
      const next = await context.client.rpc(SessionChatRpc).ask({ sessionID, question });
      if (!disposed && props.panel.sessionID === sessionID) setView(next);
    } catch (error) {
      if (!disposed) {
        setFailure(String(error));
        setView({ ...view(), waiting: false });
      }
    }
  };
  const clear = async () => {
    if (view().waiting) return;
    try {
      const next = await context.client.rpc(SessionChatRpc).clear({ sessionID: props.panel.sessionID });
      if (!disposed) setView(next);
    } catch (error) {
      if (!disposed) setFailure(String(error));
    }
  };
  const useAnswer = () => {
    const answer = view().turns.findLast(turn => turn.author === "assistant");
    if (!answer) return;
    context.ui.panel.close();
    setTimeout(() => context.renderer.keyInput.processPaste(new TextEncoder().encode(answer.text)), 0);
  };
  context.keymap.layer(() => ({
    commands: [
      { bind: "escape", enabled: () => props.panel.focused, run: props.panel.close },
      { bind: "ctrl+o", enabled: () => props.panel.focused, run: useAnswer },
      { bind: "ctrl+n", enabled: () => props.panel.focused, run: clear },
    ],
  }));
  return (
    <box flexDirection="column" backgroundColor={context.theme.background.raised.base} padding={1} gap={1} flexGrow={1} onMouseDown={props.panel.focus}>
      <text fg={context.theme.text.base}>Side chat</text>
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        <Show when={view().turns.length === 0}><text fg={context.theme.text.muted}>Ask about the conversation. The main chat does not see these turns.</text></Show>
        <For each={view().turns}>{turn => (
          <box flexDirection="column" border borderColor={context.theme.border.base} paddingX={1} marginBottom={1}>
            <text fg={context.theme.text.muted}>{turnAuthors[turn.author].label}</text>
            <Show when={turnAuthors[turn.author].markdown} fallback={<text fg={context.theme.text.base}>{turn.text}</text>}>
              <markdown content={turn.text} syntaxStyle={style()} />
            </Show>
          </box>
        )}</For>
        <Show when={view().waiting}><text fg={context.theme.text.muted}>Response in progress…</text></Show>
        <Show when={failure()}><text fg={context.theme.text.base}>{failure()}</text></Show>
      </scrollbox>
      <textarea ref={editor} focused={props.panel.focused} minHeight={3} maxHeight={6}
        backgroundColor={context.theme.background.raised.base}
        focusedBackgroundColor={context.theme.background.raised.base}
        textColor={context.theme.text.base} focusedTextColor={context.theme.text.base}
        placeholderColor={context.theme.text.muted} cursorColor={context.theme.text.base}
        placeholder="Ask the side chat"
        keyBindings={[{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }]}
        onSubmit={() => void send()} />
      <box flexDirection="row" gap={2}>
        <text fg={context.theme.text.base} onMouseDown={() => void send()}>[Send]</text>
        <text fg={context.theme.text.base} onMouseDown={useAnswer}>[Use in prompt]</text>
        <text fg={context.theme.text.base} onMouseDown={() => void clear()}>[New]</text>
        <text fg={context.theme.text.base} onMouseDown={props.panel.close}>[Close]</text>
      </box>
      <text fg={context.theme.text.muted}>Ctrl+O: use answer · Ctrl+N: new</text>
    </box>
  );
}
