import { expect, test } from "bun:test";
import { branchGlyph, groupByDirectory, leafName } from "./tree";

test("groupByDirectory keeps the ranking order of directories and files", () => {
  expect(groupByDirectory(["src/auth.ts", "src/db.ts", "docs/api.md"])).toEqual([
    { dir: "src", paths: ["src/auth.ts", "src/db.ts"] },
    { dir: "docs", paths: ["docs/api.md"] },
  ]);
});

test("groupByDirectory folds a directory that reappears into its first group", () => {
  expect(groupByDirectory(["src/a.ts", "docs/b.md", "src/c.ts"])).toEqual([
    { dir: "src", paths: ["src/a.ts", "src/c.ts"] },
    { dir: "docs", paths: ["docs/b.md"] },
  ]);
});

test("groupByDirectory puts a root-level file under the empty directory", () => {
  expect(groupByDirectory(["README.md"])).toEqual([{ dir: "", paths: ["README.md"] }]);
});

test("branchGlyph closes the last file of a group", () => {
  expect([0, 1, 2].map((index) => branchGlyph(index, 3))).toEqual(["├──", "├──", "└──"]);
});

test("leafName drops the directory the heading already shows", () => {
  expect(leafName("a/b/c.ts")).toBe("c.ts");
  expect(leafName("c.ts")).toBe("c.ts");
});
