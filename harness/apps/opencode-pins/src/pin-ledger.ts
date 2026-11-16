import { z } from "zod";

export const PinRecord = z.object({ url: z.string(), title: z.string(), why: z.string() });
export type PinRecord = z.infer<typeof PinRecord>;

export const PinUpdate = PinRecord.extend({
  order: z.array(z.string()),
});
export type PinUpdate = z.infer<typeof PinUpdate>;

export function validatePinUrl(value: string): URL {
  const url = new URL(value);
  if (!["https:", "http:", "file:"].includes(url.protocol)) {
    throw new Error("Pin URL must use HTTP, HTTPS, or a local file.");
  }
  if (url.protocol === "file:" && url.hostname !== "" && url.hostname !== "localhost") {
    throw new Error("Pin file URL must refer to this computer.");
  }
  return url;
}

export function rankSessionPins(current: readonly PinRecord[], input: PinUpdate): readonly PinRecord[] {
  validatePinUrl(input.url);
  const pins = new Map(current.map(pin => [pin.url, pin]));
  pins.set(input.url, { url: input.url, title: input.title, why: input.why });
  if (input.order.length !== pins.size || new Set(input.order).size !== pins.size || input.order.some(url => !pins.has(url))) {
    throw new Error("Pin order must contain every pinned URL exactly once.");
  }
  return input.order.map(url => pins.get(url)!);
}

export interface PinStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: readonly PinRecord[]): Promise<void>;
}

function sessionPinKey(sessionID: string): string {
  return `sessions/${sessionID}`;
}

export class SessionPins {
  private updates = new Map<string, Promise<unknown>>();
  private snapshots = new Map<string, Promise<readonly PinRecord[]>>();

  constructor(private storage: PinStorage) {}

  async list(sessionID: string): Promise<readonly PinRecord[]> {
    let snapshot = this.snapshots.get(sessionID);
    if (!snapshot) {
      snapshot = this.storage.get(sessionPinKey(sessionID)).then(stored => stored === undefined ? [] : z.array(PinRecord).parse(stored));
      this.snapshots.set(sessionID, snapshot);
    }
    try {
      return await snapshot;
    } catch (error) {
      if (this.snapshots.get(sessionID) === snapshot) this.snapshots.delete(sessionID);
      throw error;
    }
  }

  async pin(sessionID: string, input: PinUpdate): Promise<readonly PinRecord[]> {
    const previous = this.updates.get(sessionID) ?? Promise.resolve();
    const update = previous.catch(() => {}).then(async () => {
      const ranked = rankSessionPins(await this.list(sessionID), input);
      await this.storage.set(sessionPinKey(sessionID), ranked);
      this.snapshots.set(sessionID, Promise.resolve(ranked));
      return ranked;
    });
    this.updates.set(sessionID, update);
    try {
      return await update;
    } finally {
      if (this.updates.get(sessionID) === update) this.updates.delete(sessionID);
    }
  }
}
