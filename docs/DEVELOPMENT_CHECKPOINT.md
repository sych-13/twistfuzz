# Development checkpoint

Updated 2026-10-19 (Asia/Manila). Package **0.5.0-dev.7**; V0.5 remains incomplete.

## Resume rules
Continue this existing app; read CODEX_HANDOFF.md, CODEX_PROJECT_SPEC.md, README.md, PROMPTS/ and the changelog. Preserve Elegant Garden, all 24 original assets, and separate Customer/Staff/Admin portals. Owner resumed on October 19 after requesting a usage reserve for questions; exact account usage is not visible. Work in useful tested milestones, never consume tokens as busywork or promise automatic restart.

GitHub/Vercel delivery and the named free-tier development Firebase/Supabase setup are already authorized. Do not request those approvals again, create replacements, link billing, enable paid services or real payments. Main pushes automatically deploy the protected Vercel frontend. No public privileged signup or mock runtime tokens.

## Actual latest work
- Dev.7 adds shared PostgreSQL rate limits: global 600/60 seconds before JWT work, verified UID 60/60 seconds before current-account/role/operation work. Server-owned fixed windows, atomic row updates, bounded cleanup, no raw UID/token/IP storage. Fail closed on RPC errors/missing/malformed decisions; 429 includes Retry-After. See RATE_LIMITS.md for tradeoffs.
- CLI-generated migration is applied and aligned with remote history: 20261019085735_request_rate_limits.sql. SHA-256 d3049506764fb310f511ed42694467bc44bf861f8946bf0f4d11531724d4c955. Do not reapply archived foundation drafts.
- Three Edge Functions are deployed at version 3 with readiness=false. Existing Firebase cryptographic handlers remain required despite gateway verify_jwt=false. Source packager includes dependencies/config/lockfile.
- Full local gate: **145 Node/DOM/database, 5 Deno, 17 browser tests PASS**; all three Edge typechecks, build, 24 original assets. Browser duration 102.1 seconds, no failures/retries. npm/Deno audits report no known vulnerabilities.
- Hosted SQL assertions pass under actual service_role, inside a rolled-back transaction. Anonymous limiter RPC denied 401/42501; private counter schema denied 406/PGRST106. Closed-function checks: initial 35 PASS/1 request timeout; the exact timeout case passed two targeted reruns with expected 415. Preserve both reports. The timeout cause was not isolated.
- Post-test readback: database project pin NULL, integration=false; counters/profiles/designs zero. Security advisors: four INFO RLS/no-policy notices, intentionally no browser access; no WARN/ERROR. Links/rationale in QA report.
- Prior dev.6 completed secure runtime credentials, disabled deployment and request-body bounds. Dedicated Firebase service account only has users.get/users.update, credentials only in Supabase secrets. Nine credential checks passed. See SERVER_CREDENTIALS.md.
- Owner's first Admin email is confirmed and stored only in ignored .env.owner.local. No business Admin account/role, enrollment or recovery has been created. Never infer Admin authority from Google CLI ownership.

## Next required work
1. Validate enabled, real two-Customer/provider/role/audit/saved-design flows and concurrent sessions. Closed-gateway and SQL tests do not certify full runtime operations. Rate-limit concurrency/load, gateway 429, provider abuse controls and outage behavior still need validation.
2. Implement trusted private first-owner enrollment and pre-established independent recovery, preserving mandatory MFA. No public first-factor-only Admin setup or bypass. Review AUTHENTICATION_RECOVERY.md; Staff direct Firebase password-recovery controls remain unresolved.
3. Google browser sign-in and actual verification/reset email delivery remain untested. Earlier provider fixtures were admin-verified and removed.
4. Exercise deployed credential rotation; coordinate custom-claim writers. Keep all readiness flags false until full controls pass. Do not advance to V0.6.
5. Official prices pending, production lead times deferred, payments disabled. Deferred 910.79 kB Studio warning remains; Deno legacy request-abort advisory has tested listener cleanup.

## Resources and evidence
- Repository sych-13/twistfuzz, branch main; protected stable site https://twistfuzz-bloom-preview.vercel.app. Latest tested source is the dev.7 commit in git log; hosted source verification is recorded separately.
- Supabase xoitxpoqejpprjyejgjv / twistfuzz-dev, Singapore, Free organization ffqjeyyjjnfbsspyfjff; Firebase twistfuzz-dev-sych13, billing disabled. Native Firebase trust and standalone JWT/JWKS/TOTP/revocation checks previously passed.
- docs/qa/v0.5.0-dev.7-* holds current evidence; earlier reports retained. Use npm.cmd run check and npm.cmd audit. Run scripts/check-disabled-backends.mjs with a versioned report path to preserve historical evidence.
- Never print raw firebase login:list --json, environment files, CLI credentials or private keys. .env.local contains a private Vercel OIDC value and must remain ignored. Test-results is cleared by browser tests; never keep irreplaceable helpers/credentials there.
