// Newlines survive only inside a fence, and the fence must be longer than any
// backtick run in the text itself.
export function fenced(text: string): string {
  const longestRun = [...text.matchAll(/`+/g)].reduce(
    (max, match) => Math.max(max, match[0].length),
    0,
  );
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}\n${text}\n${fence}`;
}
