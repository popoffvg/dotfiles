# Flow pseudocode — test example

A self-contained workflow-pseudocode set whose bindings point at **real lines** in
`harness/claude/scripts/flow-reveal.mjs`, so reveal actually jumps somewhere.

Files:
- `handle-reveal.workflow.ts` — typed pseudocode; one notable `if` carries a `// <ULID>`.
- `handle-reveal.bindings.json` — that ULID → real source.
- `components/resolver.d.ts` — component declarations with `@source` tags (autocomplete + reveal).
- `_flow.entities.d.ts` — shared ambient types/helpers.
- `tsconfig.json` — makes the editor type-check + autocomplete the workflow file.

## Test in Zed

1. **Open the folder** `examples/flow/` in Zed (open the *folder*, not just a file, so the
   TS server finds `tsconfig.json` and `$ZED_WORKTREE_ROOT` is set to a directory).
2. **Autocomplete** — in `handle-reveal.workflow.ts`, type `Resolver.` → method completions
   from `components/resolver.d.ts`.
3. **Reveal a notable `if`** — put the cursor on the `if (!hit)` line (the one with the ULID)
   and press **`cmd-alt-r`** → `flow-reveal.mjs:73` opens.
4. **Reveal a component** — `cmd-click` `Resolver` to jump into `resolver.d.ts`, then put the
   cursor on any method's `@source` line and press **`cmd-alt-r`** → the real `flow-reveal.mjs`
   line opens.

## Test from the CLI (no Zed)

```sh
R=~/.claude/scripts/flow-reveal.mjs
# print where a line resolves (don't open):
node "$R" reveal examples/flow/handle-reveal.workflow.ts 15 --print
node "$R" reveal examples/flow/components/resolver.d.ts 8 --print
# lint: every ULID + @source resolves, no orphan ULIDs:
node "$R" check examples/flow
# generate a ULID for a new notable branch:
node ~/.claude/scripts/flow-ulid.mjs
```

Expected: reveal prints `…/flow-reveal.mjs:73` / `:108`; check prints
`ok: 5 source binding(s) resolve; 1 workflow ULID(s) all mapped`.
