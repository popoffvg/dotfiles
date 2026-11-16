import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";
import { SideView } from "./side-chat";
import { SessionReference } from "./session-reference";

export const SessionChatRpc = Rpc.define({
  id: "session-chat",
  methods: {
    list: { input: SessionReference, output: SideView },
    ask: { input: SessionReference.extend({ question: z.string() }), output: SideView },
    clear: { input: SessionReference, output: SideView },
    summarize: {
      input: SessionReference.extend({ messageID: z.string(), direction: z.enum(["above", "below"]) }),
      output: z.object({ text: z.string() }),
    },
  },
  events: { updated: { schema: SessionReference } },
});
