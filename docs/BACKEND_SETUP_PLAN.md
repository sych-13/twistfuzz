# Approved development backend setup

Updated 2026-10-17 (Asia/Manila). The owner explicitly approved the named organization and free-tier Firebase/Supabase development setup, without paid upgrades. Both projects now exist. Do not request approval again for the same authorized setup.

## Verified current state

| Provider | Actual resource | Verified controls |
| --- | --- | --- |
| Supabase | `twistfuzz-dev`, `xoitxpoqejpprjyejgjv`, Singapore `ap-southeast-1` | Free organization, quoted USD 0/month, ACTIVE_HEALTHY, PostgreSQL 17.11; secure foundation applied to the empty development DB. |
| Firebase | `TWISTFUZZ Dev`, `twistfuzz-dev-sych13` | Billing disabled/no linked account; web app registered; Identity Platform with email/password, Google and authenticator TOTP configured. SMS/anonymous disabled; email enumeration protection enabled. |

[Supabase dashboard](https://supabase.com/dashboard/project/xoitxpoqejpprjyejgjv) and [Firebase console](https://console.firebase.google.com/project/twistfuzz-dev-sych13/overview).

The owner saved Supabase's Firebase Third-Party Auth integration. A real intended-project Firebase JWT with `role: authenticated` returns HTTP 200 through PostgREST; tampering returns 401. The database still has no project pin and `integration_enabled=false`, no profiles/designs/audits, and NULL official prices. Public configuration is in ignored `.env.local`; client readiness is false and the Vercel preview build also forces it false.

Actual validation: full local gate **114 Node/DOM/DB + 3 Deno HTTP + 17 browser tests**, three Edge entrypoint typechecks, build, 24 assets PASS; audit zero vulnerabilities. **14 real Firebase checks**, **4 native trust checks**, **8 public Data API denial checks** PASS. Hosted SQL ownership/revision/privilege/constraint checks PASS and rolled back. No server functions are deployed. Evidence and limits: `qa/backend-setup-results.md`.

Next blockers: authenticated Supabase CLI/server secret management, deployed verified functions and abuse limits, first Admin private enrollment/recovery, Staff recovery controls, and full two-Customer/Google/email/provider integration. Do not enable readiness or advance V0.5 to V0.6 yet. Never request private credentials in chat or extract connector credentials. Normal Firebase CLI authorization works; the Firebase plugin is not required for these completed steps.

## Approved scope

| Provider | Target | Initial scope |
| --- | --- | --- |
| Supabase | `twistfuzz-dev`, Singapore `ap-southeast-1` | Development project in the owner-selected organization, Free plan only. Verify the organization and project quote before creation; stop for any nonzero cost. |
| Firebase | Display name `TWISTFUZZ Dev`, available provider-approved project ID recorded after creation | Owner's Google account, Spark/no billing account. Register the existing web frontend; email/password and Customer Google authentication. Review Identity Platform/TOTP support and limits for mandatory Admin MFA. |

The owner approved Supabase organization `icarus9963@gmail.com's Org`, ID `ffqjeyyjjnfbsspyfjff`; its plan was verified Free before creation and afterward. Firebase uses the owner's authenticated Google account. Never request passwords or private service-account keys in chat.

No paid plan upgrade, Cloud Billing link, SMS enablement, Analytics, Firebase Firestore/Storage, Maps, Resend, commerce/payment activation or real customer-data import is included. These are separate decisions. Keep the existing Vercel site and its protection intact.

## Approved implementation sequence

1. Verify owner/organization, current plan and quoted cost. Create only the approved development projects. Record actual IDs, region and plan without secrets.
2. Register public web configuration securely. Set exact authorized frontend origins/domains, supported providers, email verification and enumeration protections. Keep all application readiness gates false.
3. Configure the approved Firebase-to-Supabase trust and fixed `authenticated` transport role. Review all claim writers. Business roles remain server/database-controlled.
4. Validate the SQL review candidate in an approved full Supabase environment, generate/review a proper migration and run security/database advisors before applying it to the new development backend. Do not silently apply the candidate as a production migration.
5. Store provider/database secrets only in approved server secret storage. Configure/deploy the verified role, Customer provisioning and saved-design functions with exact CORS, abuse limits and verified handler/gateway settings. Never expose service credentials to Vite or Git.
6. Finish trusted initial Admin provisioning, factor enrollment and pre-established recovery without public privileged signup, public first-factor-only setup or MFA bypass. Validate Staff recovery against the provider's direct password-reset behavior.
7. Test real verified/unverified users, two Customers, disabled/revoked/wrong-project identities, ownership/conflicts, role escalation, MFA/recovery and audit failures through the actual gateway/PostgREST. Locally passing tests do not satisfy this gate.
8. Activate readiness only after these controls pass. The current Vercel deployment build deliberately forces readiness false; changing that build is a separate reviewed activation step after validation. Prices stay pending, lead times deferred and payments disabled.

## Cost/feature references checked

Supabase's [billing guide](https://supabase.com/docs/guides/platform/billing-on-supabase) explains organization-level plans and Free project limits. The actual project quote was USD 0/month and organization Free status was verified.

Firebase's [Authentication guide](https://firebase.google.com/docs/auth) describes Identity Platform's Spark limits and different Blaze billing. The [TOTP guide](https://firebase.google.com/docs/auth/web/totp-mfa) requires Identity Platform and verified email. Do not assume every MFA/provider feature is available free in the intended project; stop before billing-required changes. Authenticator TOTP is the proposed Admin method, with a separately validated recovery process. Paid SMS is outside this proposal.

The public Identity Platform `initializeAuth` REST endpoint documents a billing-enabled prerequisite and was not called. Firebase CLI 15.34.0's own Auth provisioning workflow initialized providers for the registered web app without linking billing. Actual billing API checks afterward confirmed `billingEnabled=false` and no account. TOTP enrollment/challenge succeeded on a disposable provider fixture; that is not first-owner enrollment or recovery validation.
