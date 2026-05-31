import type { RevealRequest, Target } from "./_flow.entities";
import { Resolver } from "./components/resolver";

export const meta = {
  name: "handle-reveal",
  description: "How `cmd-alt-r` resolves a workflow-pseudocode binding to its real source.",
};

// Reads top-to-bottom like the real flow-reveal path. Components come from
// ./components/resolver.d.ts (autocomplete). Notable branches carry a ULID
// that maps to real source in handle-reveal.bindings.json.
export function flow(req: RevealRequest): Target | never {
  const line = readLine(req.file, req.row);
  const hit = Resolver.resolveAtLine(req);
  if (!hit) {                                     // 01KSZ1B5TZK8YD8PEC7X2CDV5N
    fail(`no ULID or @source binding on line ${req.row}`);
  }

  const target = Resolver.resolveTarget(line);
  log.info("opening", { target });
  return target;
}
