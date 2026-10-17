# Local validation

## GitHub/Vercel delivery verification — 2026-10-17

Owner authorized delivery to `sych-13/twistfuzz` and Vercel. First cloud `npm ci` failed because `@opentelemetry/api@1.9.1` was missing from the optional dependency tree in the lockfile. Explicitly pinned that development dependency; local clean install then passed and cloud retry reached **READY** in 38s at commit `968e57c`.

After the fix, the complete local gate passed again: **94 local tests, 2 Deno HTTP tests, both Edge typechecks, production build, 24 assets and 16 browser tests (29.7s)**. Audit: **0 vulnerabilities**. An earlier supplementary preview build with all public fixture variables and readiness=true also remained closed (**2/2 browser checks**, 6.4s), verifying the deployment build's forced readiness gate.

Actual hosted browser checks: **12 PASS**, covering direct SPA routes, all three closed portals, 3D/local draft save/reload/reopen, disabled checkout, SHA-256 preservation and decoding of all 24 hosted original images, mobile layouts and no runtime errors. Tests authenticated only to the exact preview origin with a locally loaded short-lived Vercel OIDC header; no credential is in evidence files. Hosted screenshots were inspected; studio capture waits for the deferred component. Source and hosting delivery do not validate live Firebase/Supabase or complete V0.5.

Evidence: `qa/github-vercel-local-gate-browser-results.json`, `qa/github-vercel-forced-closed-browser-results.json`, `qa/github-vercel-clean-install-browser-results.json`, `qa/vercel-deployed-preview-results.json` and hosted mobile screenshots. See `DEPLOYMENT.md` for the deployment URL, project/repository linkage and protection behavior.

## 0.5.0-dev.4 verified Customer onboarding — 2026-10-17

`npm.cmd run check` passed: **94 Node/DOM/database tests** (12 drafts, 20 auth/build guard, 11 portal policy, 9 MFA components, 25 database, 17 Customer), **2 Deno loopback HTTP tests**, both Edge entrypoint typechecks, production build, **24 original assets**, and **16 browser regressions** (29.1s, no failures/retries). A follow-up `npm.cmd audit --json` exited 0 with **0 vulnerabilities**.

Customer tests combine locally generated RSA-signed fixture tokens, the actual cryptographic verifier/HTTP handler and PostgreSQL/WASM provisioning/audit operations. They verify fixed-role creation, identity derivation, idempotent retry, preserved Staff/Admin/inactive profiles, invalid/current-account denials, caller field/body rejection, claim/audit failures, conflicting transport roles, project readiness, role changes before completion and client token refresh/cancellation sequencing. Provider account/claim calls are test adapters; no fixture token or mock login is accepted by application runtime endpoints.

The SQL candidate now pins server provisioning and business-role reads to the enabled Firebase project. A new database test verifies wrong/disabled-project denial. Creation/audit is atomic within PostgreSQL; provider claims are a separate operation and can require retry/reconciliation. Custom-claim writers must be coordinated because Firebase claim replacement does not offer compare-and-set here.

Evidence: `qa/v0.5.0-dev.4-database.tap`, `qa/v0.5.0-dev.4-browser-results.json`, and version-prefixed screenshots/static MFA markup. The browser report records 16 expected, 0 unexpected, 0 flaky and 0 skipped. These browser checks validate the unconfigured compiled app and static MFA layout, not live Customer onboarding. Static fixtures remain outside `public/`/`dist/`.

Production build: initial app **483.36 kB / 131.35 kB gzip**, portal **16.20 kB / 5.78 kB gzip**, on-demand Supabase SDK **227.62 kB / 59.20 kB gzip**, deferred studio **902.42 kB / 244.36 kB gzip**. The deferred 3D chunk warning remains.

Live Admin SDK calls, custom-claim propagation/concurrent writers, actual email/Google/MFA/recovery, hosted gateway/PostgREST/RLS and deployed limits remain unvalidated. The schema is still a disabled local review candidate; account-backed saved-design API/UI remain unimplemented. V0.5 is not complete and authentication stays disabled. No external system was modified, payment enabled or public deployment made.

## 0.5.0-dev.3 database ownership/RLS candidate — 2026-10-17

`npm.cmd run check` passed: **73 Node/DOM/database tests** (the previous 49 plus 24 database tests), **1 Deno HTTP test**, Edge typecheck, production build, **24 original assets**, and **16 browser regressions** (28.8s, no failures/retries). `npm.cmd audit`: **0 vulnerabilities**.

Database evidence is from actual PostgreSQL **18.6/WASM via PGlite 0.5.10**, loading the unmodified foundation and the new schema review candidate. The engine runs in memory with no external connection URL or database listener. The tests exercise real SQL roles, table/column/function permissions, RLS, CHECK constraints, metadata triggers, transactions and rollback. Gateway claims are supplied by a test-only `auth.jwt()` helper; these tests do not independently verify token signatures or replace the runtime verifier.

Verified database behavior: default-disabled configuration; own active text-UID profile/design access; anonymous and cross-user denial; rejected wrong-project/unverified/expired/malformed claims; no Staff/Admin Customer-design access; create/read/update/delete with generated revisions; stale editor detection; immutable identity/metadata; no self-assigned roles/activation/audit writes; 30-stem/per-flower-option/shape bounds; parity with all 390 frontend combinations; immediate profile deactivation; restrictive defenses under accidental extra permissive policies/grants; and service-only fixed-role Customer provisioning with idempotence and audit-failure rollback.

Evidence: `qa/v0.5.0-dev.3-database.tap` and `qa/v0.5.0-dev.3-browser-results.json`. Browser screenshots use the same version prefix. No frontend design changes were made in this prerelease; production asset sizes/3D warning remain as recorded for dev.2.

This is **not hosted Supabase RLS certification**. No live migration, gateway/PostgREST configuration, deployed version compatibility, genuine simultaneous database sessions, real account provisioning HTTP flow or saved-design network API was tested. Review `DATABASE_ACCESS.md` before converting the SQL candidate into a real migration. The schema adds `profiles.is_active`; the runtime role adapter now requires that prerequisite. V0.5 and all live-auth readiness gates remain incomplete/disabled.

## 0.5.0-dev.2 MFA interface — 2026-10-17

`npm.cmd run check` passed in full: **49 Node/DOM tests** (12 drafts, 20 auth/build-guard, 8 portal-policy, 9 MFA component), **1 Deno HTTP test**, Edge entrypoint typecheck, production build, all **24 original assets**, and **16 browser tests** (28.9s, no failures or retries). `npm.cmd audit` reports **0 vulnerabilities**.

The new tests verify wrong-role/unverified/error paths sign out rather than authorize; refreshed email verification; cancellation and late-result invalidation; code validation including leading zeroes; SMS entry unavailable before a successful send; factor changes clearing codes; busy-state cancellation; late/failed SMS handling; accessible errors; and absence of an Admin recovery bypass. The actual compiled app also ignores client role/MFA query/storage hints and has no public `/admin/setup-mfa` route.

Screenshots for all three portals at 1440px and 390px and static MFA layout evidence are under `qa/v0.5.0-dev.2-*`. Desktop Admin portal and mobile MFA screenshots were visually inspected. `qa/v0.5.0-dev.2-browser-results.json` retains the browser output. The static MFA HTML is generated outside `public/`/`dist/` for visual checks only; component interactions are tested separately with callback fixtures. No mock account or authentication bypass is included in the app.

Production build: initial app **483.36 kB / 131.35 kB gzip**, separate portal **15.05 kB / 5.44 kB gzip**, on-demand Supabase SDK **227.62 kB / 59.20 kB gzip**, deferred studio **902.42 kB / 244.36 kB gzip**. The 3D large-chunk warning remains.

Live Firebase MFA, reCAPTCHA/SMS delivery, factor expiry/quotas, user creation/email, actual account/revocation checks, trusted role/audit writes, RLS, initial owner enrollment/recovery and account-backed designs are **not validated**. The UI implementation and local tests do not satisfy those integration gates. See `AUTHENTICATION_RECOVERY.md`, including the unresolved distinction between hidden Staff/Admin reset UI and Firebase's direct recovery APIs.

## 0.5.0-dev.1 local preparation — 2026-10-17

Latest fully completed milestone remains v0.4. V0.5 is in development, with no live authentication enabled. Continued work is tracked in `DEVELOPMENT_CHECKPOINT.md`.

Actual checks for this prerelease:

- `npm.cmd run check` passed: 12 draft unit tests, 19 auth/config tests, 24 original asset checks, Deno entrypoint typecheck, one Deno loopback HTTP denial test, production build and 13 browser regressions (50.2s, no failures/retries).
- A separate actual-Vite build-guard test passed for two invalid private-credential configurations; neither emitted a browser bundle or echoed the credential fixture. `test:auth` now includes this test alongside the 19 auth/config cases.
- `npm.cmd audit`: 0 vulnerabilities.
- Raw browser evidence: `qa/v0.5.0-dev.1-browser-results.json`; screenshots use the same version prefix and retain the earlier v0.3/v0.4 evidence.
- Initial app chunk: 463.96 kB / 128.16 kB gzip. On-demand Supabase client: 227.62 kB / 59.20 kB gzip. Deferred studio: 902.42 kB / 244.36 kB gzip (large-chunk warning remains).

Auth tests generate RSA fixture keys in process and exercise actual JOSE signature verification. They reject forged/wrong-project/expired/malformed tokens, unsafe key headers, unverified/disabled/deleted/revoked accounts, unprovisioned/forged roles, privileged Google login, Admin access without MFA and unavailable auditing. Request tests exercise HTTP methods, body bounds, CORS, error redaction and disabled configuration. Trusted account/database responses are test fixtures; this does not prove the unconfigured external adapters work against live projects.

The Deno HTTP test has loopback network permission only and verifies the same request/runtime factory refuses unconfigured access. It does not contact Firebase/Supabase. A read-only check of Google's public JWKS endpoint returned HTTP 200 with four RS256 keys, but no real Firebase user token was obtained or tested. Read-only connected Supabase project discovery returned zero projects.

Still unverified: deployed gateway behavior/rate limits, real account/revocation and role/audit reads/writes, RLS, MFA challenge/enrollment/recovery, trusted provisioning, per-user saved designs and all commerce integrations. No remote systems were written, migration applied, real payment enabled or public deployment made. See the verifier's README for the security contract and remaining gates.

## v0.3 and v0.4 historical validation

Test host: Windows, Node 24.11.0, npm 11.6.1, installed Microsoft Edge headless via Playwright 1.64.1. No Firebase/Supabase environment credentials. Browser checks use the production build served on loopback, not a public deployment.

| Check | v0.3 repaired baseline | v0.4 final |
| --- | --- | --- |
| TypeScript + Vite production build | PASS | PASS |
| SHA-256 preservation and image-container checks | 24/24 PASS | 24/24 PASS |
| Original flyer manifest | 15/15 unverified reference entries PASS | 15/15 PASS |
| Browser tests | 4/4 PASS (8.9s) | 13/13 PASS (26.4s) |
| Draft unit tests | Not present in v0.3 | 12/12 PASS |
| npm audit | 0 vulnerabilities after targeted repair | 0 vulnerabilities |

The final v0.4 `npm.cmd run check` exited 0, followed by `npm.cmd audit` exiting 0. Unit tests include 390 flower/color × wrapper × ribbon round trips, malformed JSON, unsupported versions/dates/options, invalid counts, duplicate rows, combined stem limits, empty designs, untrusted metadata stripping, blocked storage, quota failures and rapid sequential stem changes.

Browser verification covers:

- Direct home/shop/Lookbook/studio routes, `/home` redirect, unknown routes and no unhandled page exceptions on normal flows.
- All 24 original images decoded by the browser, alongside unchanged SHA-256 hashes.
- Anonymous dashboard redirects; unconfigured login controls disabled; no public Staff/Admin registration, Google Sign-In or password reset actions.
- Customer registration state resets when navigating to Staff/Admin portals.
- Full keyboard-save → reload → explicit reopen → reset → reopen → removal flow, including all design fields.
- Corrupt and over-30-stem drafts preserve current work; unavailable storage and quota failures report errors.
- 30-stem button limits, zero-stem draft round trips, WebGL-unavailable fallback, and cross-tab updates without replacing unsaved work.
- Main public/login pages fit 390px; desktop/mobile studio and homepage screenshots inspected. Mobile controls remain immediately after the viewer, before the new draft/summary panels.

Evidence: `qa/v0.3-browser-results.json`, `qa/v0.4-browser-results.json`, `qa/v0.4-studio-desktop.png`, `qa/v0.4-studio-mobile.png`, `qa/v0.4-home-desktop.png`.

## Repairs and observed warnings

- Incoming source lacked Vite environment types and contained unused imports. The original Python asset command was unavailable on this host; replaced with a Node check plus full browser decoding. The first browser test assertion needed `innerText` to account for a heading line break; final runs pass without retries.
- The dependency audit initially reported four high entries caused by Firebase's transitive Node gRPC dependency. A scoped override pins `@grpc/grpc-js` to patched 1.13.6; no Firebase major upgrade. Advisories: [certificate authorization](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and [error disclosure](https://github.com/advisories/GHSA-f596-whhp-79r4). This app uses Firebase Auth; live Firestore compatibility is not claimed.
- Vite still warns about the deferred 902.42 kB 3D chunk (244.36 kB gzip). The initial app chunk is now 462.02 kB (127.39 kB gzip), versus 1,356.58 kB before splitting the studio. The warning does not fail the build.
- Browser tests use software WebGL; they do not certify all device GPUs, photorealistic flower fidelity or production performance. Accessibility checks cover labels, keyboard activation, pressed states and notices; this is not a full accessibility audit.

## Next-version gate

V0.5 is **not complete**. This checkout has only the empty `.env.example`; there is no deployed `resolve-role` implementation, configured Firebase project, validated Firebase-to-Supabase trust/RLS integration or Admin MFA/recovery. These prerequisites are explicitly required by `PROMPTS/V0.5_AUTH_INTEGRATION.md` and the handoff before advancing. Live auth, RLS, MFA, email, order, inventory, delivery and payment integration tests were **not run**.

Do not provision or modify external systems without approval. No real payments, checkout, public deployment or migration application occurred. Official prices remain pending and production lead times remain deferred.
