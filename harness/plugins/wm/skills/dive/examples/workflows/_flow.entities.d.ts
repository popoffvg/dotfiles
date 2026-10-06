export type StoreKey = string;
export type Range = { start: number; end: number };
export type Change = { range: Range | null; text: string };
export type Comment = { line: number; lastLine: number; hash: string; orphaned: boolean };
export type Effect = "PersistStore" | "RefreshInlayHints" | "PublishDiagnostics";
