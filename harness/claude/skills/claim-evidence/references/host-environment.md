# Your shell is not the host's shell

Running the command yourself and seeing it work proves it works *for you*. The host that will
actually run it differs in ways that each silently break a working command:

| Difference | What breaks | How to check |
|---|---|---|
| **PATH** | a GUI-launched host (Zed ACP agent, desktop app, launchd) has no `~/.local/bin`, no version-manager shims, often no `node` | `env -i HOME=$HOME PATH=/usr/bin:/bin:/usr/sbin:/sbin <command>` |
| **`TMPDIR`** | per-process; two processes that must share state through it never find each other | put shared state at a fixed path, not `$TMPDIR` |
| **Sandbox** | writes outside the allowlist, network, GUI access | read the `sandbox` block in settings, then test under it |
| **Process lifetime** | the host kills the command's process tree when its turn ends, taking a spawned window or server with it | start it, let the host's call end, then check the process is still alive |
| **Interpreter shebang** | `#!/usr/bin/env node` fails when the host's PATH has no node, even after you found the script | invoke through an absolute interpreter, not the shebang |

## What to do

1. **Run it the way the host will**, with the host's environment — not from your shell.
2. If the host is a plugin skill, call a **resolver script** shipped with the plugin instead of a bare
   command name, and locate both the program and its interpreter inside that script.
3. **Say which path you verified.** "Works when I run it" and "works when the skill runs it" are two
   claims; only report the second when you tested the second.

## Give the failure a voice

A command launched by a host is usually run with its output discarded, so a failure reaches nobody.
Keep the spawned process's stderr in a known file and mention that path in the message the host
receives. Never let a launch failure reuse a normal outcome's message — "the reader closed the
window" and "the window never opened" must not print the same text, or the true cause is invisible.
