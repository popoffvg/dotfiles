import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function workflowBody(name: string): string {
  const source = readFileSync(new URL(`./wm-code-${name}.js`, import.meta.url), "utf8");
  return source.slice(source.indexOf("\n}\n") + 3);
}

test("implementation preserves risk tiers through approval and review fixups", async () => {
  for (const risk of ["green", "yellow", "red"]) {
    const calls: { agentType: string; label: string; phase: string }[] = [];
    let reviews = 0;
    const agent = async (_prompt: string, options: typeof calls[number]) => {
      expect(options).not.toHaveProperty("model");
      expect(options).not.toHaveProperty("effort");
      calls.push(options);
      if (options.label.startsWith("adr-approval:")) return { exit: 0, stdout: "" };
      if (options.phase === "Review") {
        reviews += 1;
        return reviews === 1
          ? { exit: 1, base: "base", failed: [{ rule: "behavior", severity: "high", findings: ["Fix the behavior."] }] }
          : { exit: 0, base: "base", failed: [] };
      }
      return { status: "done", summary: "done" };
    };
    const result = await new AsyncFunction("args", "agent", "phase", "log", workflowBody("impl"))(
      { todo: 1, risk }, agent, () => {}, () => {},
    );
    expect(result.result).toBe("PASS");
    expect(reviews).toBe(2);
    const implementers = calls.filter((call) => call.label.startsWith("impl:") || call.label.startsWith("fixup:"));
    expect(implementers).toHaveLength(2);
    expect(implementers.map((call) => call.agentType)).toEqual(
      Array(2).fill(risk === "red" ? "wm:implementer-heavy" : "wm:implementer"),
    );
    expect(calls.filter((call) => !implementers.includes(call)).every((call) => call.agentType === "effort-light")).toBe(true);
    expect(calls[0].label).toBe("adr-approval:TODO-1");
  }
});

test("auto passes risk to its child and selects native tier profiles", async () => {
  const calls: { agentType: string; label: string; phase: string }[] = [];
  const children: unknown[] = [];
  const agent = async (_prompt: string, options: typeof calls[number]) => {
    expect(options).not.toHaveProperty("model");
    expect(options).not.toHaveProperty("effort");
    calls.push(options);
    if (options.label === "ledger") return { todos: [{ todo: 1, risk: "red" }], e2eCommand: "verify", deployTask: "deploy" };
    if (options.phase === "Lessons") return { appended: [] };
    if (options.phase === "Status") return { status: "done", commit: "commit", outcome: "done" };
    if (options.phase === "Reconcile") return { statuses: [{ todo: 1, status: "done" }] };
    return { result: "green", ran: options.phase, status: "done" };
  };
  const child = async (_name: string, args: unknown) => {
    children.push(args);
    return { result: "PASS", round: 1, history: [] };
  };
  const result = await new AsyncFunction("args", "agent", "phase", "log", "workflow", workflowBody("auto"))(
    {}, agent, () => {}, () => {}, child,
  );
  expect(result.result).toBe("PASS");
  expect(children).toHaveLength(1);
  expect(children[0]).toHaveProperty("risk", "red");
  expect(calls.find((call) => call.phase === "Capture")?.agentType).toBe("effort-medium");
  expect(calls.find((call) => call.phase === "Squash")?.agentType).toBe("wm:implementer");
  expect(calls.filter((call) => !["Capture", "Squash"].includes(call.phase)).every(
    (call) => call.agentType === "effort-light",
  )).toBe(true);
});
