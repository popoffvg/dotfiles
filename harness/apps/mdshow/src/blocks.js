/**
 * Split a markdown document into annotatable blocks.
 *
 * A block is the smallest thing a reader points at: one heading, one paragraph,
 * one list, one fenced code block. Line numbers are 1-based and inclusive so a
 * comment can name `file.md:12-15` the way a reviewer would.
 */

const FENCE = /^(\s*)(`{3,}|~{3,})/;

export function splitBlocks(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let current = null;
  let fence = null;

  const flush = () => {
    if (current == null) return;
    blocks.push({
      id: `b${blocks.length}`,
      startLine: current.startLine,
      endLine: current.startLine + current.lines.length - 1,
      text: current.lines.join("\n"),
    });
    current = null;
  };

  const start = (index, line) => {
    current = { startLine: index + 1, lines: [line] };
  };

  lines.forEach((line, index) => {
    if (fence != null) {
      current.lines.push(line);
      if (line.trimStart().startsWith(fence)) {
        fence = null;
        flush();
      }
      return;
    }

    const fenceMatch = line.match(FENCE);
    if (fenceMatch != null) {
      flush();
      start(index, line);
      fence = fenceMatch[2];
      return;
    }

    if (line.trim() === "") {
      flush();
      return;
    }

    // A heading or a thematic break stands alone.
    if (/^\s{0,3}#{1,6}\s/.test(line) || /^\s{0,3}(\*\s*){3,}$|^\s{0,3}(-\s*){3,}$|^\s{0,3}(_\s*){3,}$/.test(line)) {
      flush();
      start(index, line);
      flush();
      return;
    }

    if (current == null) start(index, line);
    else current.lines.push(line);
  });

  flush();
  return blocks;
}

/** One-line label for a block, used in the comment list and in the feedback. */
export function blockLabel(block, maxLength = 90) {
  const firstLine = block.text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "" && !FENCE.test(line)) ?? block.text.split("\n")[0].trim();
  const plain = firstLine.replace(/^#{1,6}\s+/, "").replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}
