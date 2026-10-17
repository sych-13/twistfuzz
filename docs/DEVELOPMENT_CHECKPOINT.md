# Development checkpoint

Last updated: 2026-10-17 (Asia/Manila).

The owner explicitly requested continued autonomous local development, testing and fixes without a repeated “continue” instruction for each milestone. An active thread Goal records this objective. Usage limits and session availability still apply; automatic restart after quota refill is not guaranteed. Never waste tokens or generate busywork merely to consume the allowance.

## Current source

- Owner authorized GitHub + Vercel delivery on 2026-10-17. Local Git now tracks `https://github.com/sych-13/twistfuzz.git`, branch `main`; source commit `968e57c` is deployed as a protected Vercel Preview and passed 12 hosted checks. Existing Vercel project `twistfuzz-bloom-preview` is Git-connected after owner-configured Login Connections/App access. See `docs/DEPLOYMENT.md` before future hosting work. The deployment build explicitly forces authentication readiness false. `.env.local` now contains CLI-created local development authentication and must remain ignored; do not print or commit it.
- Git push `c3063c9` subsequently triggered a confirmed READY Git-source production-target deployment (30s), updating `https://twistfuzz-bloom-preview.vercel.app`. Exact homepage and stable `/studio` returned 200; all existing protection/auth/payment gates remain. Metadata evidence: `docs/qa/vercel-git-delivery-results.json`. Future pushes to main now deploy automatically; account for that external effect before pushing later application changes. Documentation-only follow-up pushes preserve the tested app source.
- v0.3 repaired and validated; v0.4 local bouquet drafts implemented and validated.
- Package `0.5.0-dev.5`, V0.5 **in progress, not released**: local server identity/role verification, real-SDK MFA interface, Customer provisioning, per-Customer saved-design endpoint/Studio library and tested database ownership/RLS review candidate are implemented. Readiness gates and private-key build guard remain. Do not mark V0.5 complete before real project/gateway/PostgREST/provisioning/saved-design integration and mandatory Admin enrollment/recovery tests.
- Read `CODEX_HANDOFF.md`, `CODEX_PROJECT_SPEC.md`, the roadmap and changelog when resuming. Preserve Elegant Garden and every original image/logo. Do not restart the app.

## Current blockers

- No Firebase environment values or server service-account credentials are configured.
- Read-only Supabase project discovery on 2026-10-17 returned no projects. Do not create a project or change external systems without explicit approval.
- No Docker or Supabase CLI is available. Deno 2.9.6 is now installed as pinned local npm development tooling, alongside JOSE 6.2.12 and Firebase Admin 14.5.0. Supabase JS is pinned to 2.118.0. The Deno verifier entrypoint typecheck and loopback HTTP denial test passed.
- PGlite 0.5.10 / PostgreSQL 18.6/WASM now provides disposable in-memory SQL testing. It is not a configured Supabase stack and does not substitute for deployed PostgREST/gateway/advisor validation. The original migration remains unapplied and unchanged.
- Prices remain pending. Production lead times remain deferred. Real checkout/payments and backend integration stay disabled; owner-authorized protected frontend hosting is active.

## Next useful work

Latest full gate passes: **114 Node/DOM/database tests** (previous 94 + 14 saved-design/SQL/SDK + 6 component), **3 Deno HTTP tests**, **24 original assets**, all three Edge entrypoint typechecks, build and **17 browser tests** (38.5s). Follow-up component checks and forced-closed deployment build pass. Audit: **0 vulnerabilities**. Evidence is under `docs/qa/v0.5.0-dev.5-*`. The deferred 3D chunk warning remains (~911 kB). Repeated read-only Supabase project discovery still returned zero projects on 2026-10-17.

Next useful work, still within V0.5:

1. The SQL candidate and local RLS tests exist: `supabase/schema-drafts/auth_design_access.sql`, `tests/database.test.mjs`, `tests/helpers/database.mjs`, and `docs/DATABASE_ACCESS.md`. Do not apply it live or pretend it is a generated migration. It starts disabled. Runtime now requires service-only, project-pinned `resolve_business_role(uid,project_id)` and `provision_customer_profile(uid,email,project_id)` plus the new profile activation column.
2. Customer HTTP/client provisioning is implemented and locally tested. See `supabase/functions/provision-customer/README.md`, `_shared/customer.ts`, `src/services/customer.ts` and the Customer tests. UID/email derive only from verified/current Firebase identity; transport setup uses Firebase Admin, audited fixed `authenticated` claims, read-back, client refresh and a final business-role check. Live provider/RPC/claim propagation remain untested. SQL creation is atomic with its audit; Firebase writes are separate and may need idempotent retry. Coordinate custom-claim writers before activation; read/spread/write is not compare-and-set.
3. Saved-design endpoint/SDK/Studio library are implemented and locally tested. Start with `supabase/functions/saved-designs/README.md`, `src/features/studio/savedDesigns.ts`, `AccountDesignLibrary.tsx`, `AccountDesigns.tsx`, `src/services/designs.ts` and `tests/saved-designs*`. Verified ownership + RLS via user-token/public-key request clients; strict fields, expected revisions, bounded pages, explicit open/delete confirmation, late-result/edit preservation and no silent write retries. The new function is NOT deployed; real PostgREST/gateway/user switching/concurrent sessions require approved integration testing. Offset pages may shift under concurrent writes; repeated creates intentionally make copies. Browser-local preview drafts remain separate. A separate `/account/designs` page is not added; the dashboard links to the Studio account panel.
4. Initial Admin factor enrollment and pre-established recovery remain unimplemented; do not add a public first-factor-only enrollment or MFA bypass. Review `AUTHENTICATION_RECOVERY.md`: hiding reset forms does not itself restrict Firebase's direct password-recovery API, so the intended Staff/Admin recovery controls require real configuration and testing.
5. Actual Firebase/Supabase projects, server secrets, live MFA/provider/RLS validation and deployed rate limits remain unavailable. Preserve all release gates while making useful local progress.

The React quality checklist was applied to the extracted portal/MFA components. Test identities and callback fixtures are test-only; static MFA markup is outside the deployed app. Persist concrete remaining work here before a turn ends.
