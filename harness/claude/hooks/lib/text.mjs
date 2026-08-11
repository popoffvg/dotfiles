// Word-level helpers shared by the hooks that measure repetition.
// dry-check.mjs compares blocks of one message; comment-check.mjs compares a
// comment against the code under it. Both need the same notion of "content word".

// Function words carry no topic, and leaving them in makes any two passages on
// one subject look like copies of each other.
export const STOP = new Set(`a an the and or but if then than that this these those is are was were be been being
do does did doing have has had having it its as at by for from in into of on onto to with without so such
not no nor can could will would should may might must we you i they he she them us our your their there here
also just only very more most other another each any all both same own too own via per about over under`.split(/\s+/));

// Keep a path or dotted identifier as ONE token: splitting `hooks/dry-check.mjs`
// into five words would let a single repeated path fake a restatement.
export function tokenize(text) {
  const flat = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>|]/g, " ")
    .toLowerCase();
  return flat
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w/.]+|[^\w/.]+$/g, ""))
    .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
}

export function bigrams(tokens) {
  const set = new Set();
  for (let i = 0; i + 1 < tokens.length; i++) set.add(`${tokens[i]} ${tokens[i + 1]}`);
  return set;
}

// Every word a reader can see in a line of code: identifiers split on case and
// on the separators, plus the innards of string literals — a name like
// "pl7.app/liabilities/liabilityType" states "liability" and "type" out loud.
export function codeWords(lines) {
  const words = new Set();
  for (const line of lines) {
    for (const part of line.split(/[^A-Za-z0-9_]+/)) {
      if (!part) continue;
      for (const piece of part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_]+/)) {
        const w = piece.toLowerCase();
        if (w && !/^\d+$/.test(w)) words.add(w);
      }
    }
  }
  return words;
}
