---
name: debug-oauth-idp-errors
description: Debugging an OAuth2/OIDC identity-provider rejection — invalid_scope, invalid_client, invalid_redirect_uri, "refresh token required", or a backend "authentication error" during SSO login against an external IdP (Logto, Auth0, Okta, Google, Entra). Use before changing auth flags/config to fix such an error.
---

Probe the IdP to isolate the offending parameter before changing config. Do not drop or swap several auth params on one guess.

## Steps

1. **Fetch the discovery doc.** `curl -s --compressed {issuer}/.well-known/openid-configuration -o disc.json`, then read `scopes_supported`, `claims_supported`, `code_challenge_methods_supported`, `grant_types_supported`, `token_endpoint_auth_methods_supported`. Tenant-level support ≠ per-app grant — a scope listed here can still be rejected for a specific client.

2. **Probe the authorize endpoint one parameter at a time.** Build the authorize URL with a dummy PKCE challenge and the real `client_id`/`redirect_uri`; read the redirect without following it:
   ```
   curl -s -o /dev/null -D - "{authorize}?client_id=..&response_type=code&redirect_uri=..&scope=openid&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=x" | grep -i '^location:'
   ```
   - `303 → /sign-in` (or the IdP login page) = parameter set accepted.
   - `303 → {redirect_uri}?error=invalid_scope&scope=<name>` = rejected; the `scope=` query names the offending value. Loop over scope combinations to find which single scope fails.

3. **Change one input per iteration.** An `invalid_scope` that persists after removing scope A does not prove A was the cause — isolate by adding scopes back one at a time (step 2), not by editing multiple flags between runs.

4. **Read the server log for the real reason.** The client shows a generic "authentication error / login failed"; the backend log carries the cause. Relaunch with debug logging to a file (not stdout) so the log is readable, then grep the actual error line.

5. **Interpret common causes:**
   - `refresh token required` (backend can't store the session) ⇒ request `offline_access`; a refresh token is issued only if the app also permits it.
   - `resource`/audience param ⇒ a non-existent API resource makes every requested scope "not allowed"; verify the resource exists at the IdP or omit the param (the id_token stays a JWT regardless).
   - `invalid_redirect_uri` ⇒ the exact loopback URI (`http://127.0.0.1:{port}/callback`) must be pre-registered on the app.
