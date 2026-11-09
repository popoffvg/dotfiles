# Recorded miniauth installation

Verified on 2026-10-29. These identifiers locate the existing installation; inspect live state before reusing them.

| Resource | Recorded value |
| --- | --- |
| Repository | `popoffvg/miniauth` |
| Todoist project | [miniauth](https://app.todoist.com/app/project/miniauth-6hrchXVrVQMFpVCf) |
| Todoist developer app | `728904`, named `miniauth Amp for Todoist` |
| Controller | [Persistent Todoist webhook](https://ampcode.com/threads/T-01a186c8-c27c-706d-84fb-bd69b02f2577) |
| Project secret | `TODOIST_AUTOMATION_CONFIG` |
| Webhook key | `todoist-miniauth` |
| Events | `item:added`, `item:updated`; Todoist API v1 |
| Trigger | Add `amp`; controller consumes it at dispatch |
| Result | One worker per attempt; result and worker link in a task comment; task stays open |
| Saved code | Controller Orb branch `automation/todoist-webhook`, commit `a70243a`; not pushed |
| Private endpoint file | `/home/user/todoist-webhook-url.txt`, mode 600 |

The disposable [smoke-test task](https://app.todoist.com/app/task/6hrcj8fqMJPFrWmf) received one result from [this worker](https://ampcode.com/threads/T-01a186cf-4768-70ec-9c95-424fd4f8da85), with no file changes, and was then completed. The controller reported 11 passing tests and recovered its endpoint and completed-attempt state across a runtime restart without duplicate work or comments.

Keep the controller unarchived. Re-add `amp` after an attempt finishes to request another. Inspect the saved recovery notes in the automation code before resolving an ambiguous token rotation or prompt delivery. The actual endpoint and credentials are intentionally absent from this record.
