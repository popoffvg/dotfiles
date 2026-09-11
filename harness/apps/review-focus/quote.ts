export interface QuotedReason {
  readonly header?: string;
  readonly body: readonly string[];
}

export function wrapWords(text: string, width: number): string[] {
  const limit = Math.max(1, width);
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/).filter((entry) => entry.length > 0)) {
    let rest = word;
    while (rest.length > limit) {
      if (current.length > 0) {
        lines.push(current);
        current = "";
      }
      lines.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    if (current.length === 0) current = rest;
    else if (current.length + 1 + rest.length <= limit) current = `${current} ${rest}`;
    else {
      lines.push(current);
      current = rest;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

// A reason's first line is a header only when more lines follow it — `hunk focus add --why`
// writes "3 comment(s), latest by alice\n<body>", while a reason typed at the `i` key is one
// line and is all body, so a hand-typed reason never loses its first line to a header row.
export function quoteReason(why: string, width: number): QuotedReason {
  const lines = why.split("\n");
  if (lines.length < 2) return { body: wrapWords(why.trim(), width) };
  const header = lines[0]?.trim() ?? "";
  const body = lines.slice(1).join(" ").trim();
  if (header.length === 0) return { body: wrapWords(body, width) };
  return { header, body: wrapWords(body, width) };
}
