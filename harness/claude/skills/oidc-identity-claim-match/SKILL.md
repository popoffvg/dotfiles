---
name: oidc-identity-claim-match
description: When matching or authorizing users by identity in an OIDC/SSO login flow — admin/allowlists, role assignment, pattern/regexp matching against a login — decide which id_token claim to match on.
---

Match user-authorization rules (admin lists, allowlists, role grants, regexp
patterns) against the **human-facing identity claim** — `email`, `preferred_username`,
or a configurable `UserIDClaim` — **never the raw `sub`**.

Why: `sub` is an opaque, provider-assigned identifier (Google issues a numeric string).
An operator-written rule like `.*@corp\.com` can never match it, so the authorization
silently never fires — a security bug that passes tests using synthetic subs.

Steps when adding identity matching to an OIDC/SSO flow:

1. Identify what the token verification returns. If it exposes only `sub`, the
   human-facing claim (`email`) is being discarded — surface it.
2. Prefer a **configurable claim** (`UserIDClaim`, default the provider's identity
   claim) over hardcoding one — different IdPs name it differently.
3. Read the claim from the **already-verified** token. Re-decoding the same token
   string that verification just accepted is safe; decoding an unverified token for
   an authz decision is not. Keep decode strictly after verify.
4. Fail closed: if the claim is missing or the decode fails, deny the elevated role —
   don't fall through to a match.
5. Separate identity from authz-matching intent: the stored platform identity may stay
   `sub` while authorization matches `email`. Don't silently repurpose `sub` for both.
6. Test with a realistic token carrying the actual claim, plus a regression case proving
   an email-style pattern does NOT match an opaque `sub`.
