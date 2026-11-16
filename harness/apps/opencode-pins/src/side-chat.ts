import { z } from "zod";

export const SideTurn = z.object({ author: z.enum(["you", "assistant", "error"]), text: z.string() });
export type SideTurn = z.infer<typeof SideTurn>;
export const SideView = z.object({ turns: z.array(SideTurn), waiting: z.boolean() });
export type SideView = z.infer<typeof SideView>;

export interface SideChatStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: SideTurn[]): Promise<void>;
}

function sideChatKey(sessionID: string): string {
  return `side-chat/${sessionID}`;
}

export class SideChats {
  private waiting = new Set<string>();
  private turns = new Map<string, Promise<SideTurn[]>>();

  constructor(private store: SideChatStore, private generate: (sessionID: string, prompt: string) => Promise<string>) {}

  async list(sessionID: string): Promise<SideView> {
    let turns = this.turns.get(sessionID);
    if (!turns) {
      turns = this.store.get(sideChatKey(sessionID)).then(stored => stored === undefined ? [] : z.array(SideTurn).parse(stored));
      this.turns.set(sessionID, turns);
    }
    try {
      return { turns: await turns, waiting: this.waiting.has(sessionID) };
    } catch (error) {
      if (this.turns.get(sessionID) === turns) this.turns.delete(sessionID);
      throw error;
    }
  }

  private async save(sessionID: string, turns: SideTurn[]): Promise<void> {
    await this.store.set(sideChatKey(sessionID), turns);
    this.turns.set(sessionID, Promise.resolve([...turns]));
  }

  async clear(sessionID: string): Promise<SideView> {
    if (this.waiting.has(sessionID)) throw new Error("Side chat must finish before a new thread starts.");
    await this.save(sessionID, []);
    return this.list(sessionID);
  }

  async ask(sessionID: string, question: string, changed: () => Promise<void>): Promise<SideView> {
    const text = question.trim();
    if (!text) return this.list(sessionID);
    if (this.waiting.has(sessionID)) throw new Error("Side chat already has a question in progress.");
    this.waiting.add(sessionID);
    try {
      const { turns } = await this.list(sessionID);
      const next: SideTurn[] = [...turns, { author: "you", text }];
      await this.save(sessionID, next);
      await changed();
      try {
        const prompt = [
          "This is a private side chat about the main conversation. Answer directly and briefly. Use no tools.",
          ...next.filter(turn => turn.author !== "error").map(turn => `${turn.author === "you" ? "User" : "Assistant"}: ${turn.text}`),
        ].join("\n\n");
        const answer = await this.generate(sessionID, prompt);
        if (!answer.trim()) throw new Error("Side chat returned an empty answer.");
        next.push({ author: "assistant", text: answer });
      } catch (error) {
        next.push({ author: "error", text: `Side chat failed: ${String(error)}` });
      }
      await this.save(sessionID, next);
    } finally {
      this.waiting.delete(sessionID);
      await changed();
    }
    return this.list(sessionID);
  }
}
