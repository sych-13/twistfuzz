# Verified Customer onboarding — local V0.5 preparation

This endpoint is implemented and locally tested, but is not deployed or connected to real Firebase/Supabase projects. All existing server/client/database readiness gates remain disabled.

## Request and boundary

`POST /functions/v1/provision-customer` accepts only `{}` with a Firebase ID token in `Authorization: Bearer …`. The shared bounded HTTP handler applies exact-origin CORS, a 512-byte JSON limit, no-cache responses and redacted errors. Submitted UID, email, role or owner fields are rejected.

The endpoint:

1. Cryptographically verifies the Firebase token against the fixed Google JWKS and intended project, then checks the current Firebase account/email/disabled/revocation state. No existing business profile is required for a new verified customer.
2. Calls the service-only `provision_customer_profile(uid,email,project_id)` RPC using the verified identity and server project configuration. The database verifies its enabled project pin, inserts only Customer, preserves conflicts, refuses Staff/Admin/inactive profiles and atomically audits initial creation.
3. Reads current Firebase custom claims. An existing `role: authenticated` is retained; missing transport role is assigned only by Firebase Admin while preserving the other current claims. An existing conflicting role is rejected for administrator review. No business role is assigned through Firebase/browser metadata.
4. Writes a transport-role request audit before changing provider claims, reads back the result and records verified state before returning success. Auditing/provider/read-back failures deny a successful response.
5. Rechecks the current project-pinned, active database business role before returning `{ "role": "customer", "refreshToken": true }`.

The Customer client refreshes SDK claims, confirms the transport value is present as an availability check, and still resolves its business role from the protected server before entering a portal. Staff/Admin sign-in never runs public Customer provisioning. Cancelling/unmounting prevents new later-stage requests/navigation when possible; in-flight provider/network operations are not falsely described as aborted.

## Failure and retry

PostgreSQL profile creation/auditing is atomic. PostgreSQL and Firebase custom-claim changes are **not one distributed transaction**: a later provider failure may leave an already audited Customer profile, while the endpoint reports failure. Retrying reuses that fixed-role profile and completes/verifies transport setup without creating a duplicate or promoting/reactivating anyone. Audit intents precede provider writes so a failure after a provider mutation still has a record to reconcile.

The trusted provisioning process must own/coordinate custom-claim writes. Firebase Admin custom-claim updates replace the claim set; reading/spreading current claims does not provide a compare-and-set guarantee against other concurrent administrator/Cloud Function writers. Review all claim writers and test these cases in the intended project before activation.

## Configuration and live gate

The server uses the same server-only configuration as `resolve-role`. The current SQL candidate additionally supplies the three-argument provisioning RPC and `resolve_business_role(uid,project_id)`, both executable only by the server role. Default-disabled database configuration cannot be bypassed by a ready server environment.

After explicit project/deployment approval, route Firebase JWTs to this cryptographic verifier with appropriate gateway configuration, for example:

```toml
[functions.provision-customer]
verify_jwt = false
```

Do not deploy that gateway setting independently of the verified handler. It does not disable the handler's identity checks. Configure the native Firebase-to-Supabase integration for subsequent user-token database requests; the Postgres transport role must be `authenticated`, never a browser-submitted business role.

Local tests combine generated RSA-signed token fixtures, the actual handler/verifier and real PostgreSQL/WASM provisioning/audit operations. Firebase current-account/custom-claim behavior is represented by test-only adapters; live Admin SDK calls, claim propagation, PostgREST RPC behavior, provider concurrency, email delivery and deployed rate limits are still unvalidated. These fixtures cannot log into the application.

Owner/Staff provisioning, initial owner MFA enrollment/recovery and complete account-backed saved-design flows remain V0.5 work. The owner-approved projects, secure foundation and provider/native-trust tests are recorded in `docs/BACKEND_SETUP_PLAN.md`. This function is deployed with server readiness false; hosted denial/CORS checks pass. Application gates and payments stay disabled. Dev.6 adds a five-second total request-body deadline and validates bytes/JSON before initializing dependencies; Dev.7 implements shared database limits; enabled gateway/concurrency validation remains outstanding.

References: [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [Supabase Firebase integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth), and [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc).
