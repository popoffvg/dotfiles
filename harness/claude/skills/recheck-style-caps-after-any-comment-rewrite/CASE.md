# Cases

## 2026-09-02 — A content fixup rewrote two doc comments straight past the word caps

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6670-multiprovider-ui/pl
- **Source:** discovery — found while analyzing the TODO-2 fixup trail before squashing it
- **Task:** running TODO-2 (scope login-time identity resolution to (idpId, login)) through the wm review gate chain under /code impl
- **What I did:** dispatched a fixup round that rewrote `LoginRecord.KnownIdpIDs`'s and `adoptByEmail`'s doc comments to fix stale content the opus reviewer flagged (F2: the comment described a search that no longer existed) — with no style violation flagged against either comment at that time
- **User's words:** none — discovered from the gate reports themselves
- **Evidence:** round 2's comment-critic gate (`.notes/review/TODO-2/comment.md`) failed both rewritten comments: `KnownIdpIDs`'s second sentence exceeded the 25-word cap, and `adoptByEmail`'s doc exceeded the 60-word cap with two oversized sentences — both introduced by the round-1 fixup that had just rewritten them for content, not style
- **Ambiguous?** no — one right answer: any comment rewrite should self-check against the full style rule set before committing
- **Scope chosen:** global — the situation (content-driven comment edit skipping the style caps because style wasn't the trigger) recurs in any codebase with written comment-style rules, independent of this repo
- **Rule written:** verdict — before committing a comment rewrite, check the new text against every style cap the file's rules impose, whatever triggered the edit
- **Transcript:** not archived — captured live during /code squash
- **Session topic:** MILAB-6670 multiprovider auth UI, TODO-2

## 2026-09-02 — Same pattern recurred in a second repo, same task

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6670-multiprovider-ui/platforma
- **Source:** discovery — found while analyzing the TODO-4 fixup trail before squashing it
- **Task:** running TODO-4 (list every advertised login method in pl-client) through the wm review gate chain under /code impl
- **What I did:** dispatched a round-1 fixup that removed 8 `CONSTRAINTS`/R-number citations from doc comments (a correctness/rule fix, not a style fix); the round-2 comment-critic gate then failed 2 of those same rewritten spots for a fresh em-dash+parenthesis violation and a 60-word-cap overrun the removal left behind
- **User's words:** none — discovered from the gate reports themselves
- **Evidence:** `.notes/review/TODO-4/comment.md` round 2 — `unauth_client.ts:51-57` (em-dash next to a parenthetical) and `unauth_client.ts:177-191` (~95 words) both introduced by the round-1 fixup that had just edited them to drop a citation, not for style
- **Ambiguous?** no — same one right answer as the first case
- **Scope chosen:** global (unchanged) — second repo, same task family, confirms the situation is not tied to one codebase
- **Rule written:** no change to the existing verdict; this case is corroborating evidence for it
- **Transcript:** not archived — captured live during /code squash
- **Session topic:** MILAB-6670 multiprovider auth UI, TODO-4
