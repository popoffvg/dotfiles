# Tools

## File edits

- Use the Edit tool for a change in one file. Use the Write tool to replace a whole file.
- Use perl only for the same one-line change in many files, for example a rename: `perl -pi -e 's/old/new/g' <files>`.
- Do not use `perl -0` or another multi-line pattern. A multi-line match fails without an error, or inserts the text at the wrong place.
- Do not edit files with `sed -i`, `echo >`, or a heredoc. BSD and GNU `sed` take different flags.
- After a perl edit, run `git diff` on the changed files before the next step.
