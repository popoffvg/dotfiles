// Shared ambient types + helpers used by the example workflow pseudocode.
export interface RevealRequest { file: string; row: number }
export interface Target { path: string; line: number }
export type Ulid = string;

declare global {
  function readLine(file: string, row: number): string;
  function fail(msg: string): never;
  const log: { info(msg: string, ctx?: unknown): void };
}
