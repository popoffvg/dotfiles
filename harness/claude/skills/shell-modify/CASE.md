# Cases

## 2026-07-30 — Script verified under bash 5, run by the caller under /bin/bash 3.2

- **Repo:** `~/git/translate-with-remember` (script lives at `~/.claude/scripts/grammar-check.sh`)
- **Task:** move a grammar-check Raycast command into the extension; the TypeScript side calls `execFile("/bin/bash", [scriptPath, "--quiet", inputFile])`.
- **What I did:** edited the script, ran `bash -n ~/.claude/scripts/grammar-check.sh` and a full end-to-end run, both under the login shell (`/opt/nanobrew/prefix/bin/bash`, GNU bash 5.x). Both passed, and I reported the work as verified.
- **Correction:**
  > Error: /Users/vitaliipopov/.claude/scripts/grammar-check.sh: line 142: unexpected EOF while looking for matching `''
  >     at /Users/vitaliipopov/.config/raycast/extensions/translate-with-remember/check-grammar.js:32:638
- **Evidence:** `/bin/bash --version` → `GNU bash, version 3.2.57(1)-release`; `/bin/bash -n grammar-check.sh` → `line 142: unexpected EOF while looking for matching `''` while `bash -n` (5.x) exits 0. Cause: line 96 `<omit this section's lines entirely…>` — an apostrophe inside a here-document nested in `prompt=$(cat <<'PROMPT' … )`. Rewriting as `IFS= read -r -d '' prompt <<'PROMPT' || true` makes `/bin/bash -n` pass and the real run succeed.
- **Ambiguous?** no — one right answer. The interpreter that runs the script is the one that must accept it.
- **Scope chosen:** global — teachable to anyone writing a script an app or daemon launches; the macOS bash 3.2 / bash 5 split is not specific to this repo.
- **Rule written:** verdict — extended `shell-modify`: syntax-check and test-run with the caller's interpreter (`/bin/bash -n`), added a "who launches it?" pre-edit question, and added a Multi-line strings pattern preferring `IFS= read -r -d ''` over `var=$(cat <<'EOF' … )`.

## 2026-07-30 — Same script, second failure: GUI app environment had no USER

- **Repo:** `~/git/translate-with-remember` (script at `~/.claude/scripts/grammar-check.sh`)
- **Task:** same Raycast grammar command, run again after the bash 3.2 fix.
- **What I did:** tested only from my terminal, where the full login environment is present. I had also written the error path as `reject(new Error(errorOutput.trim() || error.message))`, so whatever stood first on stderr became the reported cause.
- **Correction:**
  > Error: Permission allow rule (Users/vitaliipopov/.claude/settings.json): Write(~/ctx/insights/**) is not matched by file permission checks — only Edit(path) rules are. Use Edit(~/ctx/insights/**) instead (Edit rules cover all file-editing tools).
  >     at /Users/vitaliipopov/.config/raycast/extensions/translate-with-remember/check-grammar.js:32:638 why?
- **Evidence:** the quoted line is a `claude` startup warning about the user's settings, not the failure. Bisecting the environment: `env -i HOME=$HOME PATH=… claude -p …` → `Not logged in · Please run /login`, exit 1; adding `USER=$USER` → `OK`, exit 0; adding `SHELL`, `LOGNAME`, `LANG` or `XPC_SERVICE_NAME` instead → still "Not logged in". With claude exiting 1 and writing nothing else to stderr, the warning was the only line left to display. After `export USER=${USER:-$(id -un)}` in the script, the same `env -i` invocation exits 0 and writes the log.
- **Ambiguous?** no — one right answer. The script must not depend on the caller's environment, and a warning must not be reported as a cause.
- **Scope chosen:** global — any script launched by a GUI app or launchd hits this; nothing here is specific to this repo.
- **Rule written:** verdict — extended `shell-modify` § Execution environment: check which environment the script inherits (`USER`, `LOGNAME`, `SHELL`, `LANG`, `TMPDIR` may all be missing), make the script self-sufficient, reproduce with `env -i`; and when diagnosing a failing child process, report the exit code with full stderr *and* stdout instead of naming the first stderr line as the cause.
