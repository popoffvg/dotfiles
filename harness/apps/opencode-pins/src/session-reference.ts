import { z } from "zod";

export const SessionReference = z.object({ sessionID: z.string() });
