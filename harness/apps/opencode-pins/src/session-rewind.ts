import type { Context } from "@opencode/plugin/tui/context";
import { SessionChatRpc } from "./session-chat-rpc";

export async function showSessionRewind(context: Context): Promise<void> {
  const route = context.ui.router.current();
  if (route.type !== "session") return;
  const sessionID = route.sessionID;
  if (context.data.session.status(sessionID) !== "idle") {
    context.ui.toast.show({ message: "Stop the response before you rewind.", variant: "warning" });
    return;
  }
  const messages = await context.client.session.context({ sessionID });
  const prompts = messages.filter(message => message.type === "user").reverse();
  if (prompts.length === 0) {
    context.ui.toast.show({ message: "This session has no prompt to rewind.", variant: "info" });
    return;
  }
  const selected = await context.ui.dialog.select({
    title: "Rewind or summarize",
    placeholder: "Select a prompt",
    options: prompts.map(message => ({
      title: message.text.replace(/\s+/g, " ").slice(0, 100) || "Attached files",
      description: new Date(message.time.created).toLocaleString(),
      value: message.id,
    })),
  });
  if (selected === undefined) return;
  const summarize = async (direction: "above" | "below") => {
    const active = context.ui.router.current();
    if (active.type !== "session" || active.sessionID !== sessionID) return;
    context.ui.toast.show({ message: "Summary in progress…", variant: "info" });
    const result = await context.client.rpc(SessionChatRpc).summarize({ sessionID, messageID: selected, direction });
    await context.ui.dialog.alert({ title: "Conversation context summary", message: result.text });
  };
  const undoActions = [
    {
      title: "Undo conversation only", files: false,
      description: "Restore the conversation to before this prompt. Keep files unchanged.",
      confirmation: "Restore conversation only?",
      message: "Restore the conversation to before this prompt. Keep files unchanged. Use /redo to cancel before the next prompt.",
      success: "Conversation restored. Files stay unchanged. Use /redo to cancel.",
    },
    {
      title: "Undo conversation and files", files: true,
      description: "Restore the conversation and affected files to before this prompt.",
      confirmation: "Restore conversation and files?",
      message: "Restore the conversation and affected files to before this prompt. Current edits to affected files can be overwritten. Use /redo to cancel before the next prompt.",
      success: "Conversation and files restored. Use /redo to cancel.",
    },
  ];
  const undo = async (option: typeof undoActions[number]) => {
    const confirmed = await context.ui.dialog.confirm({
      title: option.confirmation,
      message: option.message,
      label: { confirm: "Restore", cancel: "Cancel" },
    });
    if (!confirmed) return;
    const active = context.ui.router.current();
    if (active.type !== "session" || active.sessionID !== sessionID) return;
    await context.client.session.revert.stage({ sessionID, messageID: selected, files: option.files });
    await context.data.session.sync(sessionID);
    await context.data.session.message.sync(sessionID);
    context.ui.toast.show({ message: option.success, variant: "success" });
  };
  const action = await context.ui.dialog.select({
    title: "Choose an action",
    options: [
      { title: "Summarize above", description: "Summarize the turns before this prompt. Keep files unchanged.", value: () => summarize("above") },
      { title: "Summarize below", description: "Summarize this prompt and later turns. Keep files unchanged.", value: () => summarize("below") },
      ...undoActions.map(option => ({ title: option.title, description: option.description, value: () => undo(option) })),
    ],
  });
  await action?.();
}
