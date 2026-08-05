---
name: show
description: Show one or more markdown files in a native review window and wait for the reader's inline annotations. Invoke as `/show <files or a prompt naming them>` when the user wants to read and mark up documents — a spec, a plan, notes, a draft — before the agent acts on them.
argument-hint: <file.md ...|prompt naming the files>
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/../../scripts/mdshow.sh *), Bash(mdshow *), Read, Glob, Grep
disable-model-invocation: true
---

Turn the reader's request into one review window over one or more files, then act on the annotations
they send back. The reader's review is the deliverable of this turn — do not start building what the
documents describe.

The reader asked to review: **$ARGUMENTS**

## 1. Resolve the files

The request is either paths or a description. Both end as a list of markdown files, in the order the
reader should read them.

| Request | What to do |
|---|---|
| Paths (`notes/spec.md notes/plan.md`) | Use them as given, in that order. |
| A description (`the spec and the plan`, `what I wrote today`) | Find the files with Glob/Grep. Prefer `.notes/`, `.notes/drafts/`, then the repo. |
| A directory | List its markdown files, then keep the ones the request points at. |
| Nothing | Ask which files to show. Stop. |

Rules for the list:

- Markdown files only. Never send source code to the window — it renders markdown, not code.
- Keep it to the files the request names. Do not add neighbours that look related.
- If the description matches nothing, or matches more than about 8 files, say what you found and ask
  which ones. Stop.
- Check each path exists with Read or Glob before step 2. One unreadable path fails the whole
  command, so the reader would see no window at all.

## 2. Return the launch command

Print the exact command, on its own line, before running anything:

```
${CLAUDE_SKILL_DIR}/../../scripts/mdshow.sh show <file1> <file2> ...
```

One command, every file, in reading order. The window shows a file selector, and the reader sends one
round of feedback covering every file they opened.

Use that script path, not a bare `mdshow`: a session started by Zed or the desktop app does not have
`~/.local/bin` on PATH.

## 3. Run it and wait

Run the command you just printed with the Bash tool. It waits for as long as the reader needs.

If the call is cut short before feedback arrives, the window is still open. Run

```
${CLAUDE_SKILL_DIR}/../../scripts/mdshow.sh wait --last
```

and repeat until it prints feedback. Waiting is the work: do not review the documents yourself, do
not guess what the reader would say, do not start other tasks.

## 4. Act on what comes back

The feedback is the reader's own words. Treat it as their instruction for this turn.

| What came back | What to do |
|---|---|
| **Change these** | Apply each numbered item. Each names `<file>:<line>` and quotes its block — edit that place in that file. Items from several files share one numbering, so read the path on every one. |
| **Answer these** | Answer in prose. Do not edit a document only to satisfy one of these. |
| **Overall** | Apply to every file in the window. |
| **Marked reviewed** | The reader is done with the files under `Done with:`. Any file listed as *not marked reviewed* is unfinished — never call it approved, and say it is still unread when you report. |
| Approved, no comments | Say so in one line and stop. |
| Closed without feedback | Stop and wait for the reader's next instruction. |

If the command reports that `mdshow` could not read a file, tell the reader the path that failed and
stop. If it prints its own usage text, no file reached it: go back to step 1.
