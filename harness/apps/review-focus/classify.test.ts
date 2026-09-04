import { expect, test } from "bun:test";
import {
  DEFAULT_GENERATED_PATTERNS,
  DEFAULT_TEST_PATTERNS,
  orderPaths,
  tierOf,
  type TierRules,
} from "./classify";

function rules(focused: readonly string[] = []): TierRules {
  return {
    focusedPaths: new Set(focused),
    testPatterns: DEFAULT_TEST_PATTERNS,
    generatedPatterns: DEFAULT_GENERATED_PATTERNS,
    demoteTests: true,
    demoteGenerated: true,
  };
}

test("a marked path wins over every rule that would demote it", () => {
  expect(tierOf("api/v1/service.pb.go", rules())).toBe("generated");
  expect(tierOf("api/v1/service.pb.go", rules(["api/v1/service.pb.go"]))).toBe("focused");
});

test("test layouts and protobuf output land in their own tiers", () => {
  expect(tierOf("src/auth/session.rs", rules())).toBe("normal");
  expect(tierOf("src/auth/session_test.rs", rules())).toBe("test");
  expect(tierOf("web/src/login.spec.ts", rules())).toBe("test");
  expect(tierOf("tests/helpers/fixture.py", rules())).toBe("test");
  expect(tierOf("gen/user_pb2.py", rules())).toBe("generated");
});

test("a nested path does not match a rule anchored at the root", () => {
  const anchored: TierRules = { ...rules(), testPatterns: ["test/**"] };
  expect(tierOf("test/unit/a.ts", anchored)).toBe("test");
  expect(tierOf("crates/db/test/unit/a.ts", anchored)).toBe("normal");
});

test("ordering keeps mark order first and original order inside a tier", () => {
  const paths = [
    "gen/user_pb2.py",
    "src/a.ts",
    "src/a.test.ts",
    "src/b.ts",
    "src/z.ts",
  ];
  expect(orderPaths(paths, (path) => path, rules(["src/z.ts", "src/b.ts"]))).toEqual([
    "src/z.ts",
    "src/b.ts",
    "src/a.ts",
    "src/a.test.ts",
    "gen/user_pb2.py",
  ]);
});

test("demotion switches off without reordering anything else", () => {
  const paths = ["src/a.test.ts", "src/b.ts"];
  const off: TierRules = { ...rules(), demoteTests: false, demoteGenerated: false };
  expect(orderPaths(paths, (path) => path, off)).toEqual(paths);
});
