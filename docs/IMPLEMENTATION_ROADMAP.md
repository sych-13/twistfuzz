# TWISTFUZZ Development Roadmap

## v0.3 — validated locally

- Preserved Elegant Garden homepage, catalog, campaign, Lookbook, logo and original product images.
- Production build repaired; original-asset integrity, image decoding, routes, closed portals and mobile layouts verified.
- Firebase/Supabase remain unconfigured scaffolding; migration remains unapplied.

## v0.4 — validated locally

- Save/reopen/remove one versioned local draft with flowers, colors, counts, wrapper, ribbon and message-card selection.
- Strict restore validation: supported options, safe integer quantities, combined 30-stem cap and bounded payloads; corrupt storage never replaces current work.
- Reset, summary, accessible notices, blocked/full storage handling, cross-tab notices and 3D fallback.
- 3D studio loaded separately from marketing/auth routes; no new design direction or image replacements.
- Actual results are in `VALIDATION.md` and `CHANGELOG.md`.

## v0.5 — next, requires configuration and integration validation

- Prerelease dev.7 adds shared PostgreSQL request limits to the verifier/MFA, ownership/RLS, Customer onboarding, saved designs and bounded-request work. Development authentication remains disabled. Next: enabled provider/Customer/rate-limit/concurrency integration and initial Admin enrollment/recovery; see the checkpoint.
- Owner-approved free-tier Firebase/Supabase development projects and ignored public configuration now exist. The generated secure foundation, provider TOTP/JWKS checks, native transport trust and anonymous Data API denials pass. Full deployed-function, two-Customer, Admin enrollment/recovery and abuse-control validation remain; see `BACKEND_SETUP_PLAN.md`.
- Implement and test cryptographic Firebase ID-token verification, trusted role provisioning, per-user saved designs and ownership/RLS enforcement.
- Customer email verification, Google Sign-In and recovery; staff email/password and admin-assisted recovery; mandatory Admin MFA and pre-established recovery.
- Test invalid/expired/wrong-project tokens, cross-user access denial, privilege escalation denial, revoked access and privileged audit logs against the development backend.
- No privileged public signup, client-trusted roles or mock login access. Advance only when prerequisites and tests pass. External provisioning/changes require approval.

## v0.6 and later — gated by the previous version and approved business configuration

- Inventory ledger, transactional reservations, trusted pricing and order/payment states; confirmed Cash/GCash rules and admin-only privileged operations.
- Official product/component prices remain pending. Production lead times remain deferred; do not invent values or request them prematurely.
- Later integrate delivery routing, notifications, foreground rider GPS, retention and secure handoff OTP according to `CODEX_PROJECT_SPEC.md`.
- Faithful fuzzy-wire GLB models when approved assets are ready.

## Release gate

Build → Test → Fix → Advance within the authorized local scope. Keep real checkout/payment OFF until approved prices and backend/inventory/security controls pass integration validation. Do not publicly deploy or modify external systems without explicit approval. Local checks do not certify live authentication, RLS, MFA, payments, orders or production readiness.
