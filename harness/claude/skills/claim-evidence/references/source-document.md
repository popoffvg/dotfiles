# Answer spec questions from the source document

Read the human-written document, not the artifact you generated from it. A derived spec, TODO
ledger, or plan restates your earlier reading — if that reading was wrong, the derived file
repeats the error and the citation proves nothing.

## Procedure

1. **Locate both.** List the candidate documents before reading any:
   - source: a docs/text repo, a ticket description, a design doc the user wrote or received
   - derived: `.notes/spec.md`, `.notes/todos/TODO-*.md`, plans, handoffs, summaries — anything
     produced in this or an earlier session
2. **Ask which one only if the workspace has several plausible sources.** One source plus one
   derived file needs no question — the source wins.
3. **Read the source first and quote it.** Every claim cites the source document's path and
   line.
4. **Use the derived artifact for one thing only**: checking it agrees with the source. A
   disagreement is a finding to report, not evidence to cite.
5. **Say which document each quote comes from.** "the spec says" is ambiguous in a workspace
   with two; name the file.

## Trap

Reading the derived spec because it is nearer, better indexed, or already open, then leading the
answer with it. The user asked about the source; a quote from your own summary is the same claim
in a costume. If the derived file is the only thing you read, say so and mark the answer
unverified.

## When the derived artifact caused the user's belief

A user who reads the derived spec and reports a contradiction — "the spec requires X, we should
change the decision" — is often reporting a **wording defect in your artifact**, not a real
conflict in the source. Verify before you revise anything:

1. **Check the premise in code, not in either document.** A claim of the form "A needs B, and B
   is produced by C" is settled by finding C's producing site and A's consuming site. Two blocks
   that read the same output are peers, not a dependency chain — the same shape reappears with
   shared columns, caches, and generated files.
2. **If the premise is false, say so with the producer/consumer lines** and reverse nothing. A
   decision reversed on a false premise is expensive and silent.
3. **Then fix what misled them.** Find the word in the derived artifact that reads as a stronger
   claim than it is — "prerequisite" for what is only a checkout, "depends on" for what is only
   a pattern to copy — and reword it. Add the source's invariant to the derived artifact
   verbatim, so the derived artifact stops omitting it.
4. **Record the code evidence** as a fact note or comment, so the same premise cannot be
   re-litigated from memory next session.

The lesson: a false premise from the user is still your defect if your artifact's wording
produced it. Fix the wording; keep the decision.

## Related

`cite-no-stronger-than-the-quote` — when step 3 above copies the source's invariant into the
derived artifact, check the new sentence is no stronger than the quoted words.
`quote-the-source-row` — how to paste the evidence once the right document is open.
`verify-source-at-pinned-ref` — the same rule for code: verify against the authoritative ref,
not the convenient local copy.
