---
name: note
description: Capture a human note — a todo, a thought, a reminder, or an open question — as one file per note in `.note/personals/`. Use when the user says "note this", "note it down", "make a note", "remind me to", "add a todo", "don't let me forget", "write this down", "open questions", or states something they want to keep for themselves rather than act on now.
---

# Note

Write one note the user will read later. The note carries the short context that makes it readable weeks from now — nothing more.

A note is for the **human**, not for an agent: no plan, no options, no next steps unless the user said them.

## Usage

`/note <the note>`

## Steps

1. **Split first.** Count the separate subjects in the user's text — each open question is one, each unrelated item is one. Two or more → every step below runs once per subject. Splitting is done when every question and every item in the text maps to exactly one note.

2. Pick the **kind** from the user's words — `todo` (an action they will do), `reminder` (an action tied to a time or an event), `question` (something open, for the user to answer or ask someone), `thought` (everything else). Kind is chosen.

3. Write a **title** of 3–8 words in the user's own vocabulary. Title fits in one line and names the subject, not the act of noting. A `question` note titles the question itself.

4. Gather **short context** — the two or three facts a reader needs to place the note. Draw only from this session: the files touched, the command that failed, the decision under discussion, the person or ticket named. Context is 3 lines or fewer, and every line is something the user could not reconstruct from the title alone. Notes split from one message share the same context.

5. Run the script with the body on stdin, once per note:

   ```bash
   ~/.claude/scripts/note-new.sh <kind> "<title>" <<'EOF'
   <the note in the user's own words, 1-3 sentences>

   **Context:** <the short context from step 4>
   EOF
   ```

   The script resolves the repo root, creates `.note/personals/`, and prints the path. Every note from step 1 has a printed path.

6. Check `.note/` is ignored by git: `git check-ignore -q .note && echo ignored`. If it is not ignored, follow the `local-gitignore` skill to add `.note/` — personal notes stay out of commits and out of `git status`.

7. Report one line per note — its path and its title. Nothing else — the user asked to store notes, not to discuss them.

## Rules

- **One subject per note.** Several open questions, or several unrelated items, in one message → one note file each. A note holding two questions is two notes.
- **Keep the user's words.** Copy their phrasing into the body; expand only where a pronoun or "it" would be unreadable later.
- **Notes are not tasks.** A note never becomes work in this session. Acting on it needs a separate ask.
