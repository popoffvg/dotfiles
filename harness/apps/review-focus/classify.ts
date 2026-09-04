export type Tier = "focused" | "normal" | "test" | "generated";

export const TIER_ORDER: readonly Tier[] = ["focused", "normal", "test", "generated"];

export const DEFAULT_TEST_PATTERNS: readonly string[] = [
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/testdata/**",
  "**/*_test.go",
  "**/*_test.py",
  "**/test_*.py",
  "**/*_test.rs",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*Test.java",
  "**/*Tests.cs",
  "**/*_spec.rb",
  "**/conftest.py",
];

export const DEFAULT_GENERATED_PATTERNS: readonly string[] = [
  "**/*.pb.go",
  "**/*.pb.gw.go",
  "**/*_grpc.pb.go",
  "**/*.pb.ts",
  "**/*.pb.js",
  "**/*.pb.cc",
  "**/*.pb.h",
  "**/*.pb.rs",
  "**/*.pb.dart",
  "**/*.pb.swift",
  "**/*_pb2.py",
  "**/*_pb2_grpc.py",
  "**/*_pb.js",
  "**/*_pb.d.ts",
  "**/*.pbtxt",
  "**/*.pb.bin",
];

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index]!;
    if (char === "*") {
      if (glob[index + 1] === "*") {
        const skipsSlash = glob[index + 2] === "/";
        source += skipsSlash ? "(?:.*/)?" : ".*";
        index += skipsSlash ? 2 : 1;
        continue;
      }
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

export function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

export interface TierRules {
  focusedPaths: ReadonlySet<string>;
  testPatterns: readonly string[];
  generatedPatterns: readonly string[];
  demoteTests: boolean;
  demoteGenerated: boolean;
}

export function tierOf(path: string, rules: TierRules): Tier {
  if (rules.focusedPaths.has(path)) return "focused";
  if (rules.demoteGenerated && matchesAny(path, rules.generatedPatterns)) return "generated";
  if (rules.demoteTests && matchesAny(path, rules.testPatterns)) return "test";
  return "normal";
}

export function orderPaths<T>(items: readonly T[], pathOf: (item: T) => string, rules: TierRules): T[] {
  const focusOrder = [...rules.focusedPaths];
  return items
    .map((item, index) => ({ item, index, tier: tierOf(pathOf(item), rules) }))
    .sort((left, right) => {
      const byTier = TIER_ORDER.indexOf(left.tier) - TIER_ORDER.indexOf(right.tier);
      if (byTier !== 0) return byTier;
      if (left.tier === "focused") {
        const byMark = focusOrder.indexOf(pathOf(left.item)) - focusOrder.indexOf(pathOf(right.item));
        if (byMark !== 0) return byMark;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.item);
}
