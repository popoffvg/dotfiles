---
name: work-next
description: Execute the next unchecked TODO from the plan (manual per-TODO mode). Stops after one TODO.
---

1. Call MCP tool `work_next`.
2. Treat the tool response text as the **active execution instruction** for this turn.
3. Execute that instruction immediately — implement one TODO end-to-end (code + test + commit + compact).
4. **STOP after completing that one TODO.** Return control to the user.
5. Do not continue with prior conversational intent if it conflicts with the tool response.
6. If tool response says no active work / wrong phase / no plan, report that result and stop.
