# Development backend setup results

2026-10-17, package `0.5.0-dev.5`; V0.5 remains incomplete. Owner approved the named organization and free-tier development setup, without paid upgrades.

## Actual resources and configuration

- Supabase `xoitxpoqejpprjyejgjv` / `twistfuzz-dev`, Singapore, PostgreSQL 17.11; organization `ffqjeyyjjnfbsspyfjff` Free; quoted USD 0/month; ACTIVE_HEALTHY.
- Firebase `twistfuzz-dev-sych13` / `TWISTFUZZ Dev`; web app `1:1002678131382:web:e62bbedc6f82d4f3dce417`; billing disabled and no linked billing account.
- Firebase email/password, Google, email enumeration protection and TOTP enabled (one adjacent interval). SMS and anonymous providers disabled. Authorized domains: its `firebaseapp.com`/`web.app` hosts, stable Vercel host, localhost and 127.0.0.1. Provider readback: [Firebase evidence](backend-setup-firebase.json).
- Owner configured Supabase Firebase trust; actual Firebase JWT transport acceptance and tamper denial confirmed. [Native trust evidence](backend-setup-native-trust.json).
- Public configuration is ignored locally. No server credentials were added to tracked files/client code. Frontend and database readiness remain false; no operational Edge Functions are deployed. Prices NULL/pending; lead times deferred; no payments.

## Migration and database checks

Supabase CLI 2.121.0 generated `twistfuzz_secure_foundation`. The original foundation and reviewed access candidate were combined without SQL logic changes, tested locally, and applied to the empty approved development project. MCP history assigned version `20261017091937`; the generated file was renamed to that exact recorded version to keep local/remote history aligned.

Committed migration: `supabase/migrations/20261017091937_twistfuzz_secure_foundation.sql`; SHA-256 `d2ef88a8b37a5846e83f96282292a92252d6e5cf6694a4b9b05e0234d595c886`. The byte-preserved original is now `supabase/schema-drafts/0001_foundation.sql`, SHA-256 `b238c8ab4c56525a652a96af42d9c1e76d7e99059f88044bdfc16c46b1734df4`. Test helpers load all committed generated migrations in order.

Hosted transaction-scoped SQL checks passed: own-profile isolation, cross-owner reads/deletes denied, own create/update and revision increment, stale revision rejection, cross-owner insertion denied, profile escalation denied, 31-stem invalid design denied, deactivation blocks access. Test claims simulated the SQL gateway context; they were not signed user sessions. All fixtures/configuration changes rolled back. Final readback: profiles/designs/audits zero, six flowers with no official prices, project pin NULL, integration disabled.

[Project, migration history, functions and advisor evidence](backend-setup-supabase.json).

## Actual tests

| Gate | Result |
| --- | --- |
| `npm.cmd run check`, with real public configuration and readiness false | 114 Node/DOM/DB tests; 3 Deno HTTP tests; all 3 Edge entrypoint typechecks; build; 24 asset hashes; 17 browser tests PASS, 34.8s, no retries/failures. [Full output](backend-setup-local-check.txt). |
| `npm.cmd audit` | Zero vulnerabilities. [Evidence](backend-setup-audit.json). |
| Real Firebase SDK/JWKS/account/TOTP checks | 14 PASS, including fixture cleanup. [Evidence](backend-setup-provider-tests.json). |
| Native Firebase-to-Supabase transport trust | 4 PASS; valid JWT 200, tampered role/signature 401, closed data access, fixture cleanup. [Evidence](backend-setup-native-trust.json). |
| Anonymous Data API and schema exposure | 8 PASS: 5 tables and 2 RPCs HTTP 401/42501; private schema HTTP 406/PGRST106. [Evidence](backend-setup-data-api-denials.json). |

Real provider tests used freshly generated disposable accounts under `example.invalid`; passwords/tokens/TOTP secrets stayed in process memory, no business Admin roles were assigned, and provider account deletion was independently read back. Fixture email verification was performed by the test administrator; actual verification/reset email delivery and interactive Google login were not tested. Initial TOTP sign-in reused the enrollment time-window code and failed with `auth/invalid-verification-code`; waiting for a fresh code fixed the test sequence. Both runs cleaned up their fixture. No app MFA bypass or relaxed verifier was introduced.

The first audit-report parser expected UTF-8 while PowerShell redirected UTF-16; reading the correct encoding recovered the actual zero-vulnerability report. This was a report-format issue, not a passing test claim made while parsing failed.

## Advisor findings

Security has three **INFO** findings: `audit_events`, `flower_types`, `products` have RLS with no policies. These tables intentionally grant no anonymous/authenticated access; the live HTTP denial checks confirm this boundary. Do not add public policies to silence the notice. [Supabase explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Performance has one **INFO** finding: the new `custom_designs_owner_created_idx` has not been used on this empty database. Retain it for owner pagination; no production workload is measured yet. [Supabase explanation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). No WARN/ERROR findings were reported.

## Remaining limits

No full portal-to-function-to-database success flow is certified. Server secret configuration, deployed function rate limits/CORS/gateway behavior, two-Customer PostgREST mutations/conflicts, provider claim writer coordination, Google browser login, email delivery, initial Admin enrollment and independent recovery, and Staff provider-level recovery remain required. The deferred 910.79 kB Studio chunk warning also remains. Elegant Garden and all original images/logo are preserved.
