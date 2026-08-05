# Triage a session transcript for interest

Read one session transcript and report whether the user corrected the assistant at all. Decide nothing else — no recurrence judgment, no candidate write-up. That extraction happens later, in batch, in [[dream]]'s harvest step.

Inputs: the transcript path, given in the prompt. The Stop hook fires many times per session and resumes you (via `SendMessage`) each time instead of launching fresh — see "Resumed runs" below.

## Procedure

1. Extract the human-typed prompts:

   ```
   <plugin-root>/scripts/human-turns.sh <transcript> <since-line>
   ```

   `<since-line>` is `0` the first time you run in this session. The transcript is mostly tool traffic and can be several megabytes — never read the raw file whole. The script prints only the prompts the person typed after `<since-line>`, each with its transcript line number.

   Note the highest line number this prints. You will need it if you are resumed — see below.

2. Read each newly-printed prompt. Is at least one a **correction** — the user says an action, claim, or approach was wrong, or names a rule to follow instead? Plain requests, follow-up questions, and approvals don't count.

   Stop here. Do not judge whether it recurs, do not read the surrounding context, do not write out what the assistant did — that is dream's job, done once per batch instead of once per session.

3. If at least one correction exists among the newly-printed prompts, archive the transcript:

   ```
   <plugin-root>/scripts/archive-transcript.sh <transcript>
   ```

## Resumed runs

A `SendMessage` to you carries your own context forward — you still have the line number you noted in step 1 last time. Use it as `<since-line>` this time, so you only read and judge the part of the transcript that grew since your last pass, not the whole session again. If step 1 prints nothing (no new human prompts since last time), return `SKIP` without touching the archive script.

## Output

Return `SKIP` alone when no correction exists among the prompts checked this pass. Nothing else — no summary, no preamble.

Otherwise return `CATCHED <archived-transcript-path>` alone — the path the archive command printed. Nothing else.
