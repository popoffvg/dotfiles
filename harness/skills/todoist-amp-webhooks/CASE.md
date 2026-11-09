## 2026-10-29 — Activate and verify the miniauth connection

- **Repo:** `/Users/popoffvg/Documents/git/dotfiles`; deployed automation in the miniauth Amp project.
- **Source:** discovery during the requested Todoist-to-Amp setup.
- **Task:** Create a Todoist project and connect its labeled tasks to miniauth Orbs.
- **What I learned:** Filling the OAuth redirect textbox and saving did not register the URL. Committing the list entry with Enter before saving resolved both OAuth redirect errors. Personal webhooks also required OAuth authorization of the app owner's account.
- **Evidence:** Todoist authorization returned `Invalid redirect URI`, then `No redirect URI configured`; after Enter and Save, the consent page appeared and token exchange succeeded. See the setup reference's official Todoist source. One real label-add event then produced one worker and one result comment; the label-removal event did not dispatch again.
- **Ambiguous?** No for the observed console and OAuth activation; future console behavior must be checked against saved state.
- **Scope chosen:** Global; the service integration workflow is independent of the repository being worked on.
- **Rule written:** Verify persisted redirect entries, authorize the account, and prove the real event-to-worker-to-comment path before reporting readiness.
- **Transcript:** Current session; no archive path available.
- **Session topic:** Todoist webhook settings and miniauth Amp setup.
