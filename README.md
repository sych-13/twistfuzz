# TWISTFUZZ Bloom Studio — Elegant Garden v0.4

Current working package: **0.5.0-dev.4**, local authentication/MFA, verified Customer onboarding and database ownership/RLS preparation. Latest fully validated milestone: **v0.4**. V0.5 is not released or enabled against live projects. See [progress in Filipino](docs/PROGRESS.md), [actual validation](docs/VALIDATION.md) and [continuation checkpoint](docs/DEVELOPMENT_CHECKPOINT.md).

Continued from the existing v0.3 source. The approved Elegant Garden theme, official logo, campaign assets and original product references are preserved.

## Implemented local preview

- Responsive homepage, catalog, Lookbook and six-flower procedural 3D studio.
- Separate Customer `/login`, Staff `/staff/login`, Admin `/admin/login` and protected dashboard scaffolds. Without configured authentication, credential fields and sign-in are disabled and dashboards deny access.
- Local V0.5 preparation adds an enrolled authenticator/phone MFA challenge, fresh identity/role checks, cancel/retry handling and failed-access sign-out. No public Admin enrollment or recovery bypass is exposed. Provider delivery, first-owner enrollment/recovery and live integration still need validation; see `docs/AUTHENTICATION_RECOVERY.md`.
- Local Customer onboarding now derives identity from a verified token/current account, provisions only an active Customer profile through a project-pinned server RPC, audits transport-claim setup, refreshes the client token and rechecks the business role. It is disabled until real integration validation passes; see `supabase/functions/provision-customer/README.md`.
- Up to 30 stems across flower/color combinations; five wrappers, three ribbon choices and the existing message-card option.
- **V0.4:** explicitly save, reopen or remove one browser-local preview draft. Flowers, colors, quantities, wrapper, ribbon and message-card selection are preserved. Reopening validates storage before changing the current bouquet.
- Reset returns to the original five-stem design while keeping the saved draft. Reloading starts with the original design; use **Reopen saved draft** to restore saved work. Unsaved edits are not automatically stored.
- Drafts are shared by anyone using the same browser profile and origin, do not sync across devices or accounts, and can be lost when browser data is cleared. No personal message, account data, prices or permissions are stored in drafts.
- Design summary, named color buttons, keyboard focus, live notices, storage failure handling and a fallback when 3D rendering is unavailable.

The 3D bouquet remains a procedural prototype, not final sculpted chenille/fuzzy-wire models. Palette options do not assert real inventory availability.

## Run locally

Use Node.js 24+ for validation (tested with Node 24.11.0). From **this inner project directory**:

```text
npm ci
npm run dev -- --host 127.0.0.1
```

On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`. Do not change system execution policy just to run this app.

## Validate

```text
npm test
npm run build
npm run test:e2e
npm audit
```

`npm run check` runs unit tests, original-asset checks, the production build, and browser tests in sequence. The asset check uses Node, so Python/Pillow are no longer required.

The gate also checks the Deno server entrypoint and runs `npm run test:database` against disposable in-memory PostgreSQL/WASM (PGlite). The SQL review candidate defaults disabled and is not a live migration. No Docker, connection string or external database is needed for these local tests. See `docs/DATABASE_ACCESS.md`; actual hosted Supabase trust/RLS/PostgREST validation remains pending.

Browser tests use installed Microsoft Edge in headless mode, start a temporary loopback Vite preview at `127.0.0.1:4173`, and verify the compiled app. Port 4173 must be free. Tests expect this unconfigured development preview; they do not exercise live Firebase/Supabase credentials. Traces and the JSON report go into ignored `test-results/`. Selected screenshots and version-specific results are retained in `docs/qa/`. See `docs/VALIDATION.md` for actual results and limitations.

## Authentication and next version

Only `.env.example` is supplied. No projects have been provisioned or live systems modified. The local V0.5 preparation adds a tested cryptographic verifier and request handler, a disabled server adapter, readiness gates and a pre-build private-key guard. See `supabase/functions/resolve-role/README.md` for its exact limits and server configuration. Never put service-role keys, Firebase service-account keys or other private keys in `VITE_*` variables or tracked files. Use `.env.local` only for the public client configuration described in `.env.example`; keep `VITE_AUTH_INTEGRATION_READY=false` until actual integration tests pass.

**V0.5 is gated:** it needs the intended Firebase and Supabase development projects, a deployed cryptographic Firebase token verifier with trusted role lookup, verified ownership/RLS controls, customer email verification and Google Sign-In, and mandatory Admin MFA and recovery. A frontend role guard alone is not backend authorization. Do not enable real logins or claim V0.5 complete until those controls pass integration tests. No mock account access or privileged public signup is enabled.

## Business and deployment restrictions

Official product/component prices are **pending**; printed numbers in original photos and flyers are **unverified references**. Production lead times remain **deferred**. Checkout and real payments stay disabled. This is not a working commerce system.

On 2026-10-17 the owner authorized GitHub + Vercel delivery. Source is in [sych-13/twistfuzz](https://github.com/sych-13/twistfuzz); a tested [protected Vercel preview](https://twistfuzz-bloom-preview-8jf46vh0o-icarus9963-7076.vercel.app) serves commit `968e57c`. Sign in with the owning Vercel account if prompted. GitHub is connected to the existing Vercel project. See `docs/DEPLOYMENT.md` for exact evidence and limitations. The deployment build forces authentication readiness false; no backend migration or payment activation occurred. Further backend/billable/payment changes require separate approval. The Supabase migration remains an unapplied draft.
