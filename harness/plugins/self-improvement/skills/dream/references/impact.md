# Which later corrections would a note have prevented?

You get a list of accepted notes and a list of traced causes. Each cause has an id, the session it came from, the defect, and the input the agent followed. For each pair the caller lists, decide one thing: **if the note had been in force, would the agent have avoided this defect?**

- `prevents` — the note's rule, applied by the agent or by a review gate, forbids the defect or names the right method for it.
- `no` — the note is about something else, or the defect would still happen with the note in force.

Be strict: a shared topic is not a match. The note must name the action that went wrong. Return only the JSON the schema asks for, one row per listed pair.
