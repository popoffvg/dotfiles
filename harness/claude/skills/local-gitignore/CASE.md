# CASE.md — local-gitignore

## 2026-07-29 — wiring a repo-local excludesFile silently displaces the global one

- **Repo:** `~/git/mil/text`
- **Task:** `/note` wrote a personal note to `.note/personals/`; its step 5 found `.note/` was not ignored and routed here to wire a local gitignore.
- **What I did:** Followed the skill as written. Two problems surfaced in the skill itself, and one trap the skill did not mention:
  - Step 2's command carried a stray extra argument — `git config --local core.excludesFile .local.gitignore "$PWD/.local.gitignore"` — three args where `git config <key> <value>` takes two.
  - The `description` said to create `.gitignore.local` while the body said `.local.gitignore` and told you to rename the former to the latter. The trigger line taught the name the body forbids.
  - **The trap:** `core.excludesFile` holds one path, so the repo-local value *replaces* `~/.gitignore` rather than adding to it. In this repo `~/.gitignore` was the only thing ignoring `.claude/.cc-writes/` — which exists here — so wiring the local file as documented would have silently un-ignored it and surfaced it in `git status`. Caught it by checking `git config --global core.excludesFile` and `git check-ignore -v` before writing, then copied both global patterns into `.local.gitignore` with a comment.
  - Also hit `error: could not lock config file .git/config: Operation not permitted` — the sandbox blocks `.git/config`. And my verification `&&` chain hid it: the failed `git config` skipped `check-ignore`, and the trailing `|| echo "(clean)"` printed a false pass.
- **Correction:**
  > yes. do

  (in reply to my offer: "the `local-gitignore` skill doesn't mention that a repo-local `core.excludesFile` replaces the global one (so its patterns need carrying over), and its step 2 command has a stray extra argument.")
- **Evidence:**
  - `git config --global core.excludesFile` → `~/.gitignore`, containing `**/.claude/settings.local.json` and `**/.claude/.cc-writes/`.
  - `git check-ignore -v .claude/.cc-writes/` before wiring → `/Users/vitaliipopov/.gitignore:3` — the global file was the sole source.
  - After wiring with the patterns carried over → `/Users/vitaliipopov/git/mil/text/.local.gitignore:12`, and `git status --porcelain` clean of all three paths.
  - `git config --local` under the sandbox → `error: could not lock config file .git/config: Operation not permitted`.
- **Ambiguous?** No — one right answer. `core.excludesFile` is documented as a single path; the global patterns must be carried over or they stop applying.
- **Scope chosen:** global — extended the existing hand-authored `local-gitignore` skill rather than writing a new one; the situation is already inside its trigger. Left unstamped (no `origin: self-improvement`) since the skill is hand-authored.
- **Rule written:** verdict, added as two body sections — (1) check `git config --global core.excludesFile` and copy its patterns into `.local.gitignore` before wiring, because the repo-local value replaces rather than merges; (2) `git config --local` needs the sandbox off, and verify in a separate command so a broken `&&` chain cannot fake a pass. Also fixed the stray argument, the `1,2,2,3` numbering, and the `description`'s wrong filename.
