# TWISTFUZZ Changelog
## 0.5.0-dev.5 — Customer saved-design API/UI preparation, unreleased (2026-10-17)
- Added a Customer-only saved-design endpoint: fresh cryptographic/current-account/business-role verification per request; strict bounded commands; canonical bouquet validation; fixed page size and whitelisted responses. Every data operation uses the verified owner's predicate and a request-scoped Firebase-token Supabase client with a public key, so RLS/column grants remain enforced. No service-role design writes.
- Added expected-revision compare-and-set update/delete; stale, absent and other-owner mutations share a generic conflict. Account names, IDs, quantities/options and client responses are validated. Existing SQL candidate remains unchanged/unapplied; the new Edge Function is not deployed.
- Added a separate Studio account library with new-save, explicit open/replace, update/rename, delete confirmation and pagination. Customer dashboard links to it. Browser-local drafts are independent. Account switch/unmount invalidates late results; a bouquet edited during a pending open is preserved; duplicate in-flight writes are blocked; permission failures clear account UI data. No automatic mutation retries or exactly-once-create guarantee.
- Actual final gate: **114 Node/DOM/database tests PASS** (previous 94 + 14 saved-design/SDK/SQL + 6 component tests), **3/3 Deno HTTP checks**, all three Edge entrypoint typechecks, production build, **24/24 original assets**, and **17/17 browser tests** (38.5s, no retries/failures). Audit: **0 vulnerabilities**. Follow-up component checks pass after permission-state clearing; deployment preview build is checked separately.
- Initial test fixtures needed JSON timestamp serialization to represent PostgREST. Large DOM-object assertion diagnostics exhausted a test worker's memory; boolean presence assertions corrected that test failure. Final runs pass; these were not bypassed or marked successful while failing.
- Evidence: `docs/qa/v0.5.0-dev.5-*`. Inspected the mobile account-pending panel. Elegant Garden, all original images/logo, separate portals, pending prices and deferred lead times remain preserved. Deferred 3D bundle warning remains (about 911 kB).
- V0.5 is still incomplete. Hosted preview exposes only the pending-state panel; real Firebase/Supabase/RLS, Admin enrollment/recovery, provider/account switching, live network/concurrency and deployed rate limits require approved backend setup and validation. Login/checkout/payments remain disabled.

## GitHub/Vercel delivery preparation — V0.5-dev.4 (2026-10-17)
- Owner explicitly authorized GitHub connection/deployment and selected GitHub + Vercel, identifying existing `sych-13/twistfuzz`. Initialized local Git against the confirmed empty repository and linked the existing `twistfuzz-bloom-preview` Vercel project.
- Added explicit Vite build/output/install settings, a deployment build that forces authentication readiness false, upload/credential exclusions and repository continuation instructions. No homepage redesign, backend activation, payments or new billable resources.
- Revalidated: **94 local tests + 2 Deno HTTP tests + 16 browser tests (30.0s), 24 original assets, Edge typechecks and build PASS**; audit **0 vulnerabilities**. A supplementary preview build with all public fixture configuration/readiness=true still denied portal access: **2/2 browser checks PASS (6.4s)**. Evidence uses `docs/qa/github-vercel-*`.
- Initial automatic Git connection required the owner's GitHub Login Connection in Vercel; owner has reported completing it. Push/deploy verification is pending; see `docs/DEPLOYMENT.md` for actual delivery state.
- Initial GitHub push succeeded (`b5816e7`). First cloud preview failed at `npm ci` because the optional dependency tree lacked `@opentelemetry/api@1.9.1` in the lockfile; pinned it as a development dependency for reproducible clean installation. Retry is pending. Git integration additionally requires the Vercel GitHub App authorization, as reported by the provider.
- Final delivery: dependency-fix commit `968e57c` pushed; local clean install and full gate pass again (**94 local + 2 Deno + 16 browser tests**, 29.7s browser duration), audit **0 vulnerabilities**. Cloud preview retry is **READY** (38s). **12 hosted checks PASS**, including unchanged hashes/decoding for all 24 original images. Git connection succeeds and project metadata confirms `sych-13/twistfuzz/main`. Evidence and preview URL: `docs/DEPLOYMENT.md`. Authentication, payments and all live backend readiness gates remain disabled.
- Git webhook delivery verified: push `c3063c9` triggered source=git, target=production, **READY** in 30s and updated the stable alias. Authenticated homepage/direct-Studio HTTP checks **200 PASS**; evidence `docs/qa/vercel-git-delivery-results.json`. Existing hosting protection remains enabled. This hosting target does not certify live backend/auth/commerce readiness.

## 0.5.0-dev.4 — Verified Customer onboarding, unreleased (2026-10-17)
- Added a bounded, exact-origin Customer provisioning endpoint and client flow. UID/email come only from a cryptographically verified token and current Firebase account; submitted identity/role fields are rejected. Staff/Admin sign-in never runs public Customer provisioning.
- Project-pinned, service-only SQL RPCs now gate both profile provisioning and current business-role lookup. The provisioning RPC takes UID, email and the configured project; it remains fixed-Customer, idempotent and atomic with its creation audit. Staff/Admin/inactive profiles cannot be overwritten or reactivated.
- Added trusted Firebase transport-claim setup: preserve unrelated current claims, reject conflicting roles, audit before writes, read back and audit verification. Client refreshes the token before trusted role resolution. PostgreSQL and Firebase are not a distributed transaction; an audited profile can remain after provider failure and an idempotent retry completes setup. Concurrent claim writers must be coordinated before activation.
- Shared the bounded HTTP boundary between role/provisioning endpoints and added cancellation checks before later client stages. No fake login, public privileged signup, real credentials or external mutations were introduced.
- Actual final gate: **94/94 Node/DOM/database tests** (12 draft, 20 auth/build guard, 11 portal policy, 9 MFA component, 25 database, 17 Customer), **2/2 Deno HTTP tests**, both Edge entrypoint typechecks, production build, **24/24 original assets**, and **16/16 browser tests** (29.1s, zero failures/retries). Follow-up `npm.cmd audit`: **0 vulnerabilities**. Evidence: `docs/qa/v0.5.0-dev.4-*`.
- Initial app remains 483.36 kB / 131.35 kB gzip; portal chunk is 16.20 kB / 5.78 kB gzip. The 902.42 kB deferred 3D chunk warning remains. Elegant Garden and original logo/images are preserved.
- V0.5 remains incomplete: no live Firebase/Supabase, provider claim propagation/concurrency, gateway/PostgREST/RLS or initial Admin MFA/recovery validation. Account-backed saved-design endpoints/UI remain next. Prices pending, lead times deferred, payments/public deployment disabled.

## 0.5.0-dev.3 — Local database ownership/RLS candidate, unreleased (2026-10-17)
- Added `supabase/schema-drafts/auth_design_access.sql` as a review candidate, not a generated/deployed migration. The original foundation is unchanged; the candidate runs only in a disposable local test database and defaults to a missing project/disabled integration.
- Added text-UID/project-aware identity helpers, current profile activation checks, restrictive ownership/profile policies, explicit table/column/function grants, immutable design identity, server-maintained revisions/timestamps and strict bouquet constraints. Private helpers use SECURITY INVOKER; no browser role/activation/audit writes are allowed.
- Added a server-only, fixed-Customer-role provisioning RPC with conflict preservation and an atomic creation audit. It cannot overwrite Staff/Admin roles or reactivate profiles; the authenticated HTTP endpoint/client integration is still to be implemented.
- Updated runtime trusted-role reads to require `is_active=true`; the new schema is a prerequisite before enabling the existing server adapter.
- Added pinned PGlite 0.5.10 development tooling. Tests load the actual foundation with pgcrypto and candidate into PostgreSQL 18.6/WASM, exercise SQL grants/RLS/constraints/triggers/transactions, and retain versioned TAP output. No external connection or database service was used.
- Actual results: **24/24 database tests**, **49/49 existing Node/DOM tests** (**73 total**), **1/1 Deno HTTP test**, Edge typecheck, production build, **24/24 original assets**, **16/16 browser tests** (28.8s); npm audit **0 vulnerabilities**. Database tests include 390 option-parity cases, cross-user isolation, role escalation denial, weakened-policy/grant defenses, stale revision checks and provisioning audit rollback.
- Production asset sizes and the deferred 3D chunk warning are unchanged. Elegant Garden, all original images/logo and the three portals are preserved.
- V0.5 remains incomplete: no live gateway/PostgREST, intended Postgres version, real concurrency, Firebase/RLS/MFA/recovery integration or saved-design API/UI validated. Official prices remain NULL/pending, lead times deferred, payments and public deployment disabled.

## 0.5.0-dev.2 — MFA sign-in interface, unreleased (2026-10-17)
- Replaced the inline login implementation with a separately loaded portal component, preserving Customer/Staff/Admin routes, Elegant Garden styling, original logo and account restrictions.
- Genuine Firebase MFA-required errors now open an enrolled authenticator/phone challenge. Added six-digit code validation, leading-zero preservation, real SDK factor assertions, enrolled-phone reCAPTCHA/code request, method switching and cancel/retry behavior.
- MFA codes and SDK resolver/SMS state remain in memory; cancel/unmount discards them. Late async results cannot navigate after cancellation. Failed portal verification signs out the newly authenticated account without granting dashboard access.
- Added generic public error messages, fresh user/token verification before trusted-role lookup, accessible labels/errors and recovery guidance. Staff/Admin registration and public recovery forms remain absent; no public MFA enrollment/bypass route was added.
- Documented that initial owner enrollment, pre-established recovery, Firebase's direct password-recovery behavior, provider billing/quotas and real factor tests remain release gates. See `docs/AUTHENTICATION_RECOVERY.md`.
- Actual results: **12 draft + 20 auth/build-guard + 8 portal-policy + 9 component tests = 49/49 PASS**; **1/1 Deno HTTP test**, Edge typecheck, production build, **24/24 original asset checks**, **16/16 browser tests** (28.9s), and audit **0 vulnerabilities**. Initial JSX test-runner import issue was fixed; final runs pass without retries.
- Inspected desktop/mobile portal and static MFA screenshots. Static MFA fixtures live only under `docs/qa/`, have no auth handlers and are excluded from the application build.
- Build warning remains for the 902.42 kB deferred 3D chunk. Initial application JS is 483.36 kB; the 15.05 kB portal component and 227.62 kB Supabase SDK load separately.
- V0.5 remains incomplete: no live projects, RLS verification, trusted customer/privileged provisioning, initial Admin enrollment/recovery or per-user saved-design integration yet. Payments/public deployment disabled; prices pending and lead times deferred.

## 0.5.0-dev.1 — Local authentication preparation, unreleased (2026-10-17)
- Owner authorized continued local development without repeated “continue” prompts. Added a durable checkpoint and workspace guidance; active thread Goal records the objective. No quota-refill auto-restart guarantee is claimed.
- Added server-side Firebase-shaped JWT verification with fixed Google JWKS, strict RS256/project/claims/time validation, current Firebase account/revocation checks, trusted database role lookup, password-only Staff/Admin access, mandatory completed Admin MFA and fail-closed privileged access auditing.
- Added a bounded POST request handler with exact-origin CORS, no-cache responses, input role/UID rejection and redacted errors; Deno entrypoint and disabled runtime adapter.
- Added explicit client/server readiness gates and pre-build rejection of recognizable private credentials in public variables. Firebase and Supabase clients do not initialize when integration readiness is false. Supabase user requests use the Firebase access-token callback; the SDK loads only on demand.
- Pinned server test/runtime tooling and Supabase JS in the lockfile. Original migration remains unchanged and unapplied; no public privileges or signup were enabled.
- Actual results: **12/12 draft unit tests**, **19/19 auth/config tests**, **1/1 real Vite private-key build-guard test** (two invalid credential cases), **1/1 Deno loopback HTTP test**, Edge entrypoint typecheck, production build, **24/24 original asset checks**, **13/13 browser regressions** (50.2s), and npm audit **0 vulnerabilities**. Screenshots/reports are versioned under `docs/qa/`.
- Build still warns about the deferred 902.42 kB 3D chunk. Initial application JS is 463.96 kB; the 227.62 kB Supabase client is loaded on demand.
- **Not a V0.5 release:** no Firebase/Supabase projects or secrets configured, no verifier deployed, and no live JWT, RLS, MFA enrollment/recovery or account-backed design tests. Connected Supabase discovery returned zero projects. Real payments/public deployment remain disabled, prices pending and lead times deferred.

## v0.4 — Bouquet preview drafts (2026-10-16)
- Added explicit local save/reopen/remove for flowers, colors, stem quantities, wrapper, ribbon and the existing message-card option. Drafts are preview-only, shared within a browser profile/origin, and not linked to an account.
- Added a versioned, bounded draft schema; whitelist validation; safe integer counts; duplicate normalization; combined 30-stem enforcement; and safe handling of malformed/unsupported data and blocked/full storage.
- Added reset (keeps stored draft), an itemized summary, named colors, pressed states, focus indicators, live feedback and cross-tab notices without overwriting current work.
- Preserved Elegant Garden styling and all 24 original images. Added nearby unverified-price captions to original homepage references. Mobile customization controls stay directly after the viewer.
- Deferred the 3D studio bundle until its route opens, added a rendering fallback, and made No Ribbon actually omit ribbon meshes. The viewer remains a procedural prototype.
- Isolated portal state by role; tied dashboard permission display to the verified user/role; disabled credential fields when Firebase is unconfigured. No backend authorization or MFA completion is claimed.
- Actual final results: `npm.cmd run check` PASS — **12/12 unit tests**, **24 original asset checks**, production build, **13/13 browser tests**; `npm.cmd audit` PASS — **0 vulnerabilities**. Desktop/mobile screenshots inspected. Full evidence and limitations: `docs/VALIDATION.md` and `docs/qa/`.
- Vite retains a large deferred 3D chunk warning; initial JS reduced to 462.02 kB. No public deployment, real payments or external-system changes.
- **V0.5 prerequisite blocked:** intended Firebase/Supabase development configuration, deployed token/role verifier, validated RLS, and Admin MFA/recovery are not available. Prices stay pending; production lead times stay deferred. No later version marked complete.

## v0.3 — Local validation and repairs (2026-10-16)
- Fixed missing Vite environment types and unused imports blocking strict TypeScript compilation.
- Corrected obsolete Soft Blossom portal text to Elegant Garden.
- Removed the 3D viewer's external HDR download dependency; existing scene lighting remains local.
- Replaced the Python-only asset command with Node checks and SHA-256 baselines for all 24 original images; browser tests decode every image.
- Added a reproducible npm lockfile and Playwright checks using installed Microsoft Edge.
- Patched Firebase's transitive Node gRPC dependency to 1.13.6 for GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4. No Firebase major upgrade or live service changes.
- Actual results: production build PASS; asset checks PASS (24 unchanged images / 15 reference manifest entries); browser tests **4/4 PASS** (public routes, closed portals, image decoding, 390px layouts); npm audit **0 vulnerabilities**. Raw browser evidence: `docs/qa/v0.3-browser-results.json`.
- Build reports a large bundle warning; the build succeeds. No configured backend, live authentication, payments or deployment were tested or enabled.

## v0.3 — Elegant Garden campaign / product integration
- Approved campaign banner and poster imported.
- Source user product images included as references, with original filename manifest.
- New Lookbook route and navigation link.
- Version prompts included for planned sequential milestones.
- Prices remain unverified; no live ordering.
