# review — todo

Judge one implemented TODO. This is the review `impl:sub-auto.md` Step 2 runs per TODO, and the
one `/code impl` runs per increment and per TODO (`impl:rulesets/approve-*.md`). The run is
@../references/ref-reviewrules.md.

## Steps

1. **Name the base.** The diff is the TODO's commits plus every fixup on top of them: `--base` is
   the parent of the TODO's first commit. A caller MAY name a narrower base: `impl` names the parent
   of one increment's commit.
2. **Run reviewrules** as `ref-reviewrules.md` § Run it says, with `<target>` `TODO-N`, or
   `TODO-N/inc-<k>` for one increment. Step 1 there refreshes the ADR rules, so a Property added
   since the last run binds this one.
3. **Report** `report.md` and the exit code. On exit 0, the caller advances the TODO
   `status: verify → done`. On exit 1, the caller routes the findings
   (`ref-reviewrules.md` § A FAIL goes back to impl). An increment review sets no `status`. Green
   here means *built right* only: the `verifier` agent checked the Outcome when `status` reached
   `verify`.

**`TODO-N.agent.md` § Files names the expected reach, not a border.** A file outside that list is
not a finding by itself.
