---
name: todoist-amp-webhooks
description: Set up or repair Todoist webhooks that dispatch tasks to an Amp-managed Orb, including personal OAuth activation, project secrets, and live delivery verification.
user-invocable: false
---

# Connect Todoist tasks to Amp Orbs

[todoist-cli](../todoist-cli/SKILL.md) owns ordinary Todoist CLI operations; this skill owns the Todoist-to-Amp connection. Read [setup details](references/setup.md) when configuring the app, callback, or handler. Use [chrome-debugging](../chrome-debugging/SKILL.md) for local browser work.

For an existing connection, inspect the owning thread and live app configuration before the creation steps below. A fresh thread loading the same plugin/key does not take over the original registration. Restore the owning thread when archiving paused delivery. Read [the recorded miniauth installation](references/miniauth.md) only when working on that connection; verify its current state before changes.

1. **Resolve the two projects.** Inspect existing Todoist projects and the selected Amp executor/project. Create missing resources within the user's request. A webhook MUST run in an Amp-managed Orb. Settle the trigger and completion behavior; a useful default is an `amp` task label, consumed at dispatch, with a result comment and the task left open. Continue when the target project IDs and intended behavior are known.

2. **Register and authorize the Todoist app.** Configure the OAuth redirect, save it, and complete OAuth as the account whose tasks will trigger work. A personal webhook MUST be activated by OAuth even when the app belongs to that account. Use a temporary loopback callback for a local setup, validate `state`, and transfer credentials privately. Continue when the app's token can read the intended project and the account has authorized that app.

3. **Create the owning Orb thread.** Select the intended Amp project and the Orb executor. Store Todoist credentials in an encrypted project secret; include refresh credentials and token acquisition time when applicable. Ask Amp to inspect `amp plugins show-docs` and build against that installed API. Continue when the controller can authenticate without printing credentials and owns a registered webhook.

4. **Activate the webhook.** Transfer the endpoint from a private file to Todoist's callback field. Select the required events, normally `item:added` and `item:updated`, and the current supported API version. Activate and save. A webhook URL MUST be handled as a secret even when a general-purpose Todoist tool prints callback URLs by default. Continue when a reload confirms the saved endpoint, active status, and event selection.

5. **Prove delivery.** Verify bad-signature rejection, wrong-project/unlabeled-task filtering, and duplicate suppression through handler outcomes. Then add the trigger to one disposable task and observe a real Todoist event, one Amp worker, consumption of the trigger, and one result comment with the worker link. A 200 response proves queue acceptance only. Continue when the actual work/result path succeeds and a controller restart preserves its endpoint and completed-attempt state without duplication.

6. **Leave an operable installation.** Save the automation code on its intended branch, record the controller link and usage in the Todoist project, and complete the disposable test task. Keep the owning thread unarchived. Clean up temporary local credentials and the OAuth callback server while preserving the browser connection and authoritative runtime state. Finish when the saved code and unarchived owner are verified, usage is linked, cleanup is complete, and the report states the project link, trigger, result behavior, and recovery limitations.
