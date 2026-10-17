# Development checkpoint

Last updated: 2026-10-17 (Asia/Manila).

The owner explicitly requested continued autonomous local development, testing and fixes without a repeated “continue” instruction for each milestone. An active thread Goal records this objective. Usage limits and session availability still apply; automatic restart after quota refill is not guaranteed. Never waste tokens or generate busywork merely to consume the allowance.

## Current source

- v0.3 repaired and validated; v0.4 local bouquet drafts implemented and validated.
- Package `0.5.0-dev.4`, V0.5 **in progress, not released**: local server identity/role verification, real-SDK MFA challenge interface, verified Customer provisioning HTTP/client flow and tested database ownership/RLS review candidate are implemented. Readiness gates and the private-key build guard remain in place. Do not mark V0.5 complete before real project/gateway/PostgREST/provisioning integration, saved-design API/UI and mandatory Admin enrollment/recovery tests.
- Read `CODEX_HANDOFF.md`, `CODEX_PROJECT_SPEC.md`, the roadmap and changelog when resuming. Preserve Elegant Garden and every original image/logo. Do not restart the app.

## Current blockers

- No Firebase environment values or server service-account credentials are configured.
- Read-only Supabase project discovery on 2026-10-17 returned no projects. Do not create a project or change external systems without explicit approval.
- No Docker or Supabase CLI is available. Deno 2.9.6 is now installed as pinned local npm development tooling, alongside JOSE 6.2.12 and Firebase Admin 14.5.0. Supabase JS is pinned to 2.118.0. The Deno verifier entrypoint typecheck and loopback HTTP denial test passed.
- PGlite 0.5.10 / PostgreSQL 18.6/WASM now provides disposable in-memory SQL testing. It is not a configured Supabase stack and does not substitute for deployed PostgREST/gateway/advisor validation. The original migration remains unapplied and unchanged.
- Prices remain pending. Production lead times remain deferred. Real checkout/payments and public deployment stay disabled.

## Next useful work

Latest full gate passes: **94 Node/DOM/database tests** (12 draft, 20 auth/build-guard, 11 portal-policy, 9 MFA component, 25 database, 17 Customer), **2 Deno HTTP tests**, **24 original assets**, both Edge entrypoint typechecks, production build and **16 browser tests** (29.1s). Follow-up audit: **0 vulnerabilities**. Evidence is under `docs/qa/v0.5.0-dev.4-*`, including the database TAP report. The deferred 3D chunk warning remains.

Next useful work, still within V0.5:

1. The SQL candidate and local RLS tests exist: `supabase/schema-drafts/auth_design_access.sql`, `tests/database.test.mjs`, `tests/helpers/database.mjs`, and `docs/DATABASE_ACCESS.md`. Do not apply it live or pretend it is a generated migration. It starts disabled. Runtime now requires service-only, project-pinned `resolve_business_role(uid,project_id)` and `provision_customer_profile(uid,email,project_id)` plus the new profile activation column.
2. Customer HTTP/client provisioning is implemented and locally tested. See `supabase/functions/provision-customer/README.md`, `_shared/customer.ts`, `src/services/customer.ts` and the Customer tests. UID/email derive only from verified/current Firebase identity; transport setup uses Firebase Admin, audited fixed `authenticated` claims, read-back, client refresh and a final business-role check. Live provider/RPC/claim propagation remain untested. SQL creation is atomic with its audit; Firebase writes are separate and may need idempotent retry. Coordinate custom-claim writers before activation; read/spread/write is not compare-and-set.
3. Implement per-user saved-design endpoints/UI using current identity, owner predicates, server-side canonical bouquet validation and expected revisions. The DB candidate has column grants, strict CHECK constraints, metadata triggers and restrictive owner policies. Keep local browser preview drafts explicitly separate from account-backed records.
4. Initial Admin factor enrollment and pre-established recovery remain unimplemented; do not add a public first-factor-only enrollment or MFA bypass. Review `AUTHENTICATION_RECOVERY.md`: hiding reset forms does not itself restrict Firebase's direct password-recovery API, so the intended Staff/Admin recovery controls require real configuration and testing.
5. Actual Firebase/Supabase projects, server secrets, live MFA/provider/RLS validation and deployed rate limits remain unavailable. Preserve all release gates while making useful local progress.

The React quality checklist was applied to the extracted portal/MFA components. Test identities and callback fixtures are test-only; static MFA markup is outside the deployed app. Persist concrete remaining work here before a turn ends.
