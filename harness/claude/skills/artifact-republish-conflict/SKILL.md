---
name: artifact-republish-conflict
description: Use when updating an Artifact that this conversation did not itself publish — a branched or resumed session, a URL pasted from another chat, a page a sibling agent rewrote — or when a republish fails with a conflict ("another session published a newer version", 409). Prevents both silently clobbering the newer version and reaching for force:true when the working file is already correct.
metadata:
  origin: self-improvement
---

# Republishing an artifact someone else advanced

A conflict on republish means the server's version is newer than the `baseVersion` this
conversation tracks. **That does not mean your file is stale.** The two live independently:

- The tracked `baseVersion` is per-conversation. A branched session inherits the transcript
  but not a fresh version stamp, so it can be stale even when the file on disk is current.
- The file on disk may already contain the other session's work — most obviously when both
  sessions edit the *same* scratchpad path, which is the normal case for a branch.

So the question is never "am I allowed to publish?" but **"is my file a superset of what is
live?"** Answer it mechanically, then publish.

## The procedure

1. **WebFetch the artifact URL.** Artifact URLs are fetchable via the claude.ai login; the
   tool result includes the full rendered HTML saved to a local path — capture that path,
   it is what you diff against. (`curl` does not work here: it gets the SPA shell or a 403.)

2. **Prove containment, don't eyeball it.** Extract the structural inventory from both files
   and diff the sets. Pick anchors that would reveal deleted work — ids, section anchors,
   countable units:

   ```bash
   live=<path from the WebFetch result>
   mine=<your working file>

   # anything in LIVE but missing from MINE = work you would destroy
   comm -23 <(grep -o 'id="[a-z0-9-]*"' "$live" | sort -u) \
            <(grep -o 'id="[a-z0-9-]*"' "$mine" | sort -u)

   # countable units, as a second signal (questions, rows, entries, sections)
   printf 'live %s / mine %s\n' "$(grep -c '<unit-marker' "$live")" \
                                "$(grep -c '<unit-marker' "$mine")"
   ```

   Empty diff + your count ≥ theirs = your file is a superset. Non-empty diff = real
   divergence: merge their additions into your file first, then re-run the check.

3. **Republish plainly** (same `file_path`, and pass `url` since this conversation may not
   own the version stamp). The retry usually succeeds once the merge is genuine.

4. **Report what you verified.** Say the diff was empty and name the anchors you compared —
   "every term id, section id, and question present, 50 vs 46 questions". A bare "no
   conflicts" is not evidence.

## On force:true

`force:true` discards the other session's version. Reach for it only when the user asks to
overwrite, or when step 2 *proved* containment and a plain retry still conflicts — and say
plainly that you are overwriting a newer server version and why that loses nothing.

Never use it to skip step 2. A conflict is the only signal that another agent worked on the
page; spending it on a force is how a sibling session's hour disappears.

## Reading the fetch cheaply

WebFetch answers a prompt against the page, so ask for structure rather than prose: "list
every section heading in order; does section X contain subsection Y; how many <units> are
there". That tells you whether their version has content yours lacks without pulling the
whole document through your context — and the saved HTML path is still there for the diff.
