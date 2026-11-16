import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";
import { PinRecord } from "./pin-ledger";
import { PinPrStatus } from "./pin-pr-status";
import { SessionReference } from "./session-reference";

export const PinView = z.object({
  pins: z.array(PinRecord),
  statuses: z.record(z.string(), PinPrStatus),
  errors: z.array(z.string()),
});
export type PinView = z.infer<typeof PinView>;

export const SessionPinRpc = Rpc.define({
  id: "session-pins",
  methods: {
    list: { input: SessionReference, output: PinView },
    refresh: { input: SessionReference, output: PinView },
    open: { input: SessionReference.extend({ url: z.string() }), output: z.null() },
  },
  events: {
    updated: { schema: SessionReference },
  },
});
