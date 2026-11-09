# Todoist app and Amp controller details

## Todoist console

Open [App Management](https://app.todoist.com/app/settings/integrations/app-management). Register a separate app for the connection, then configure its service URL, description, and OAuth redirect.

The redirect field is a list editor. After typing a URL, press **Enter** to commit the entry, then **Save settings**. Merely filling the textbox and clicking Save can leave the registered redirect list empty. Reload to verify persistence. `Invalid redirect URI` and `No redirect URI configured` warrant checking that saved list before changing OAuth code.

The webhook section has its own **Activate webhook** / **Update webhook** control. Configure the callback, API version and event checkboxes there; save any remaining app changes. Confirm active status after reloading and expanding the section.

## OAuth

Use the current [Todoist authorization documentation](https://developer.todoist.com/api/v1/#tag/Authorization/OAuth). At the verified setup, the endpoints were:

| Operation | Endpoint |
| --- | --- |
| Authorize | `https://app.todoist.com/oauth/authorize` |
| Exchange or refresh tokens | `https://api.todoist.com/oauth/access_token` |

A local callback such as `http://127.0.0.1:8766/callback` can receive the code when that exact URL is registered. Request the needed scope, usually `data:read_write`, and a fresh unpredictable `state`. Bind the callback listener to loopback, suppress query-string logging, validate the returned state, and exchange the code privately. Read the actual token response: expiry and refresh tokens can be present.

An app test token is not evidence that OAuth activation for personal webhooks occurred. Verify authorization separately. Capture a CLI token into an environment variable or private pipe; a bare token-printing command exposes it in the transcript.

## Handler and dispatch contract

- A plugin MUST register the signature and delivery-ID headers explicitly; Amp drops headers omitted from `headers`. Todoist uses `x-todoist-hmac-sha256` and `x-todoist-delivery-id`.
- A handler MUST verify the base64 HMAC-SHA256 of the exact raw payload with the Todoist client secret before acting. Use a constant-time comparison and validate the event schema.
- A dispatch MUST match the authorized user and target project, then re-fetch current task state. Require an open task carrying the configured trigger.
- A callback MUST finish within Amp's handler deadline. At the verified setup this was 30 seconds; use the installed Plugin API and current docs to confirm. Persist accepted work and dispatch longer work outside the callback.
- A controller MUST persist delivery IDs and task-attempt state. Persist intent **before** consuming the trigger label, so a lost API response cannot discard work. Its own label-removal event must not start another attempt.
- A worker MUST use the intended repository and report its thread link and result through the controller. Apply the user's chosen merge, deployment and task-completion policy; preserve unrelated task labels when consuming the trigger.
- A token store MUST persist rotated access and refresh tokens securely. Recover from authoritative runtime state before stale bootstrap secrets. Ambiguous refresh-token rotation or prompt delivery needs reconciliation when the API offers no idempotency key.

## Private endpoint transfer

Have the controller write the endpoint to a mode-600 file outside the repository. Read it privately and fill Todoist directly; keep it out of thread messages, ordinary logs, and commits.

When the Orb file browser only exposes the checkout, ask the controller to create a temporary ignored copy inside it. Verify `git check-ignore` **before** writing the URL, preserve mode 600, transfer it through a private result file, and remove the copy afterward. Browser snapshots of app settings and file contents may contain credentials: capture privately and inspect only the required fields.

## Persistence

An Amp webhook belongs to its original owning thread. Idle sleep resumes automatically on delivery; archiving pauses delivery and makes the endpoint unavailable. Keep that controller unarchived and disable any automation that archives it when its turn finishes.

Persistent Orb disk state survives a process restart, but is not a backup across destroyed/replaced Orbs. Save code separately from private runtime state, and report any recovery gap. Test a restart of the controller runtime, not deletion of its Orb.

Sources: [Amp automations and webhooks](https://ampcode.com/docs/orbs/automations#webhooks), [Amp secrets](https://ampcode.com/docs/orbs/handling-secrets), [Todoist webhooks](https://developer.todoist.com/api/v1/#tag/Webhooks).
