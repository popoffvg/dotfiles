---
name: identity-bind-before-mint
description: Use when implementing or reviewing "log in as / bind this login to an existing user / map an external id to an internal account" behavior in an auth flow. Triggers when placing identity-resolution logic and deciding where it runs relative to session/JWT/token minting.
---

# Bind identity before the token is minted, not after

The authenticated identity is whatever the session/JWT **subject** (principal) is set to at token-mint time. That is the only thing grants, permissions, and "Signed in as" read. A write that decorates a user/account record AFTER authentication does not change who the user is.

## The trap

A post-auth "record login / stamp metadata / upsert user" step that runs after the token is already minted looks like it binds the identity — it doesn't. Symptoms of getting this wrong:
- The store record gets updated (metadata stamped, fields filled) so a DB check looks correct.
- But the token subject still holds the raw upstream id (OIDC `sub`, IdP user id), so "Signed in as" shows that, and grants keyed to the bound account don't apply.
- The bind is cosmetic.

## Do

1. **Trace where the subject is set.** Grep the token/JWT mint call and its `Subject`/principal assignment (e.g. `RegisteredClaims{Subject: result.Login}`, `GenerateToken`, `session.Store`). That assignment IS the identity.
2. **Put resolution before the mint.** Any "resolve external id → internal login/account" logic must run *before* that assignment and must **reassign the subject field** to the resolved identity. Resolving after the mint is too late.
3. **Verify with the end-state, not the store.** Check the actual token subject / the "Signed in as" value, not just that the account record was written. A passing DB read proves the record changed, not that the identity did.

## Note

A session key used only for refresh (e.g. OIDC session keyed by `sub`) can legitimately stay the raw upstream id — that's separate from the auth subject the rest of the system keys on. Keep the two distinct: refresh key vs. authenticated principal.
