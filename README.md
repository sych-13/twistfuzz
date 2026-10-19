# TWISTFUZZ Bloom Studio — Elegant Garden v0.4

Current working package: **0.5.0-dev.7**, authentication/MFA and saved-design preparation with bounded requests and shared database rate limits. The approved development backend stays disabled until integration controls pass. Latest fully validated milestone: **v0.4**; V0.5 remains unreleased. See [progress in Filipino](docs/PROGRESS.md), [actual validation](docs/VALIDATION.md) and [continuation checkpoint](docs/DEVELOPMENT_CHECKPOINT.md).

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
- **V0.5-dev.5:** account-design panel in the Studio with create/list/open/update/delete, names, revision conflicts, confirmation and pagination. It stays explicitly pending in the hosted preview. The server endpoint is deployed in disabled state; real account storage is unavailable until full integration passes. Browser-local drafts keep working independently. See `supabase/functions/saved-designs/README.md`.

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

The gate also checks the three Deno server entrypoints and runs `npm run test:database` against disposable PostgreSQL/WASM (PGlite), loading the committed generated migrations. The secure foundation is now applied to the approved development Supabase database and defaults disabled. Local tests need no Docker or external database. See `docs/DATABASE_ACCESS.md` and [backend setup results](docs/qa/backend-setup-results.md) for hosted SQL, native Firebase trust and Data API checks and their limits.

Browser tests use installed Microsoft Edge in headless mode, start a temporary loopback Vite preview at `127.0.0.1:4173`, and verify the compiled app. Port 4173 must be free. Tests expect this unconfigured development preview; they do not exercise live Firebase/Supabase credentials. Traces and the JSON report go into ignored `test-results/`. Selected screenshots and version-specific results are retained in `docs/qa/`. See `docs/VALIDATION.md` for actual results and limitations.

## Authentication and next version

The owner approved free-tier development setup on 2026-10-17. Firebase `twistfuzz-dev-sych13` and Supabase `xoitxpoqejpprjyejgjv` now exist; provider configuration and native trust have been checked. The secure database foundation is applied, but application integration stays disabled. Public client values are in ignored `.env.local`; the repository supplies only `.env.example`. Never put service-role keys, Firebase service-account keys or other private keys in `VITE_*` variables or tracked files. Keep `VITE_AUTH_INTEGRATION_READY=false` until the remaining deployed-function, Admin enrollment/recovery and full integration controls pass. See [approved scope and remaining work](docs/BACKEND_SETUP_PLAN.md).

**V0.5 is gated:** the three functions are deployed, with 36 hosted denial/CORS checks passing. Secure server credentials have nine verified permission/storage/cleanup checks. Remaining work includes enabled rate-limit/concurrency validation, complete Customer saved-design flows, Google browser/email verification delivery, trusted initial Admin MFA enrollment/recovery and Staff recovery controls. Standalone provider, SQL and closed-endpoint checks do not certify these flows. See [server credential procedure](docs/SERVER_CREDENTIALS.md). No mock account access or privileged public signup is enabled.

## Business and deployment restrictions

**Hosted website:** [TWISTFUZZ Bloom Studio](https://twistfuzz-bloom-preview.vercel.app). GitHub push `c3063c9` automatically deployed successfully and updated this stable alias. Existing Vercel authentication protection remains enabled; use the owning Vercel account if prompted.

Official product/component prices are **pending**; printed numbers in original photos and flyers are **unverified references**. Production lead times remain **deferred**. Checkout and real payments stay disabled. This is not a working commerce system.

On 2026-10-17 the owner authorized GitHub + Vercel delivery and subsequently free-tier Firebase/Supabase development setup. Source is in [sych-13/twistfuzz](https://github.com/sych-13/twistfuzz); Git-connected Vercel hosting serves the current protected frontend. See `docs/DEPLOYMENT.md` for exact deployment evidence. The hosting build forces authentication readiness false. No paid upgrades or payments are authorized. Backend setup results are tracked separately from frontend delivery.
