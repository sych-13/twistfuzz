# resolve-role — local V0.5 preparation, not deployed

`index.ts` is a Supabase/Deno entrypoint. Its request handler and identity verifier have local tests; the Firebase Admin/Supabase runtime adapter is typechecked and tested only in its unconfigured state. This is not a validated live integration.

## Implemented boundary

1. Accept POST with an empty JSON object and a Bearer token; reject caller-supplied roles/UIDs, unsupported methods, unapproved browser origins and bodies over 512 bytes.
2. Verify RS256 signatures using the fixed Google Secure Token JWKS endpoint, the intended Firebase issuer/audience, required claims, timestamps and UID. Token-provided key URLs are never used.
3. Require verified email, supported password/Google provider and no unconfigured tenant. Verify current account existence, email, disabled status and revocation cutoff through Firebase Admin `getUser`.
4. Read the current active business role by verified Firebase UID through service-only `resolve_business_role(uid,project_id)`. This SQL candidate RPC also requires the matching enabled project configuration. Claims such as `role`, `user_metadata` and browser input do not grant business privileges.
5. Require password sign-in for Staff/Admin and a completed Firebase TOTP/phone factor for Admin. Staff MFA remains optional.
6. Record privileged portal access in `audit_events` before granting it; fail closed if this write fails. Never log credentials, complete JWTs or provider details to callers.
7. Return only `{ "role": "customer|staff|admin" }`, with `Cache-Control: no-store` and exact-origin CORS.

## Server environment — configure only after approved development setup

| Variable | Purpose |
| --- | --- |
| `TWISTFUZZ_AUTH_ENABLED` | Defaults disabled; only exact `true` activates the server adapter after validation. |
| `TWISTFUZZ_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins; explicit localhost/127.0.0.1 HTTP origins allowed for local development. No wildcards. |
| `FIREBASE_PROJECT_ID` | Intended Firebase project ID, used for issuer/audience and service-account matching. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server secret containing the intended Firebase service account. Never use a `VITE_` name or place it in tracked files. |
| `SUPABASE_URL` | Intended Supabase development URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database credential, never a browser key. |

Missing/disabled configuration returns 503 without contacting Firebase or the database. Public client configuration additionally requires `VITE_AUTH_INTEGRATION_READY=true` before the web SDKs initialize; that flag is only an availability gate and cannot replace server authorization.

The Firebase-to-Supabase trust integration must be configured before direct user database access. Follow the official [Firebase integration guide](https://supabase.com/docs/guides/auth/third-party/firebase-auth): the Postgres JWT role `authenticated` is separate from TWISTFUZZ's trusted `profiles.role`. Do not set customer tokens to a staff/admin/service-role database role.

If routing Firebase JWTs to this custom verifier, configure the gateway explicitly after approval:

```toml
[functions.resolve-role]
verify_jwt = false
```

This disables the gateway's Supabase-token check, **not this handler's Firebase verification**. Never deploy with an unauthenticated fallback. Do not deploy this setting independently of the tested handler. See [Edge Function authorization headers](https://supabase.com/docs/guides/functions/auth-headers).

## Local checks

From the project root, run `npm.cmd run test:auth`, `npm.cmd run check:edge`, and `npm.cmd run test:edge`. The crypto tests generate local RSA fixture keys in memory, inject them only into test instances, and never create an application mock-login path. The Deno HTTP test can contact loopback only and confirms the unconfigured endpoint denies access.

## Still required before V0.5 completion

- Free-tier development setup is owner-approved and both projects exist. Firebase providers/TOTP, native Supabase trust, the generated secure foundation and standalone provider/SQL checks are recorded in `docs/BACKEND_SETUP_PLAN.md`. Server secrets and this function are not deployed yet; do not interpret project creation as application activation.
- Standalone real JWT/JWKS/current-account/TOTP/revocation tests pass, but key rotation/outages and the actual Edge Firebase Admin/database/audit integration remain untested. The applied development schema defaults disabled; full deployed-flow RLS validation is still required.
- The local MFA challenge interface now handles enrolled TOTP/phone methods and passes component/policy tests. Validate it against real providers, implement secure initial enrollment and exercise pre-established Admin recovery; no MFA bypass or browser-assigned privileged role. Admin/staff provisioning remains server-only. See `docs/AUTHENTICATION_RECOVERY.md` for the provider-level password-recovery caveat.
- Add deployed request rate limits and verify abuse limits, CORS and response behavior through the actual gateway. Local tests do not certify these controls.
- Every protected data/action endpoint needs its own verified identity, current permissions and ownership controls. Resolving a dashboard role alone does not authorize orders, inventory, payments, riders or saved designs.
