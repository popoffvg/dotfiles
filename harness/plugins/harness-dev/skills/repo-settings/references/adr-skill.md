# The per-repo adr skill

Write `.claude/skills/adr/SKILL.md` — a **workflow** skill that reads what the session decided and drafts an ADR from it. It is model-invocable: Claude offers an ADR when it notices a qualifying decision, which is the point.

## Everything is copied, not referenced

Three files in the dotfiles are the source of truth. Read them and **copy their content into the target repo**, resolving every cross-file link into inline text. The target repo is used by people who do not have these dotfiles, so it reads nothing from outside itself.

| Source | Copied into |
|---|---|
| `~/.claude/skills/adr/SKILL.md` | `.claude/skills/adr/SKILL.md` — the procedure. |
| `~/.claude/skills/domain-modeling/ADR-FORMAT.md` | The same file, inlined: metadata, template, numbering, lifecycle, the three tests. |
| `~/.claude/skills/domain-modeling/ADR-TEMPLATE.md` | `docs/adr/TEMPLATE.md`, created with the directory. |

If a source file is absent, ask the user where the canonical version lives. Inventing a second format creates the drift the single source exists to prevent.

## Frontmatter

```yaml
---
name: adr
description: Read the current session and record the architecture decisions it made as ADRs in <repo>'s docs/adr/. Use for "write an ADR", "record this decision", "ADR for what we just decided", after the SessionEnd ADR reminder fires, and when a session settles a hard-to-reverse choice — a technology with lock-in, an integration pattern, a context boundary, or a deliberate deviation from the obvious path.
---
```

## Body

Six parts, in order:

1. **Read the session** — work from the conversation, or from the transcript the `SessionEnd` reminder names.
2. **When a candidate qualifies** — the three tests and the qualifying categories, copied from the canonical format.
3. **Metadata** — the required `status` / `created` / `updated` frontmatter, and the `## Changelog` section that closes every ADR.
4. **Template and numbering** — copied from the canonical format, pointing at `docs/adr/TEMPLATE.md` as the file to copy.
5. **Lifecycle and archiving** — the status transitions, and the rule that a superseded or deprecated ADR is `git mv`-ed to `docs/!archived/adr/`.
6. **Repo-specific additions**, if any — the reviewer for an ADR in this repo, a decision log linked from elsewhere, a naming convention already in use in `docs/adr/`.

## Rules

- **Offer, do not write silently.** The skill shows a draft and asks. An ADR records what the team decided; the team confirms the wording.
- **Take the decision the user approved**, not the one Claude proposed.
- **Most sessions produce zero ADRs.** Reporting "nothing qualifies" is a correct outcome.
- **Number from both directories.** Scan `docs/adr/` and `docs/!archived/adr/` for the highest number and add one. A number is never reused.
- **Every edit updates metadata.** Bump `updated` and append a line to the `## Changelog` section at the end of the file, including when only the status changes.
- **Create `docs/adr/` lazily.** The first ADR creates the directory together with `TEMPLATE.md`. An empty directory tells a reader nothing.
- **Create `docs/!archived/adr/` on the first supersession.** Not before.
- **Add the README pointer with the first ADR.** README section *Decisions* appears once `docs/adr/` holds an ADR.
