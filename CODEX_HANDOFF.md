# TWISTFUZZ — Codex Handoff

**Date:** 2026-10-16  
**Latest complete local source:** v0.4, *Elegant Garden* (continued from this v0.3 handoff)  
**Working prerelease:** `0.5.0-dev.5` — tested local authentication/MFA, Customer onboarding and saved-design API/UI; live backend integration still gated.
**Development status:** Local development resumed by owner on 2026-10-16. V0.3 and V0.4 validation results are in `docs/CHANGELOG.md` and `docs/VALIDATION.md`. V0.5 requires Firebase/Supabase configuration and security integration validation. No public deployment or real payments enabled.

**Hosting update (2026-10-17):** Owner subsequently authorized GitHub + Vercel delivery. Source is now on `sych-13/twistfuzz`; the existing Vercel project is Git-connected and a protected preview of commit `968e57c` passed 12 hosted checks. See `docs/DEPLOYMENT.md`. Authentication/payments remain disabled and V0.5 is incomplete.

Owner reaffirmed autonomous continuation on 2026-10-17. Resume from `docs/DEVELOPMENT_CHECKPOINT.md` and the active thread Goal. Local V0.5 verifier/request/configuration tests pass; do not equate them with a completed live Firebase/Supabase, RLS or MFA integration. External projects remain unprovisioned.

## Do this first

1. Open this folder as the workspace in VS Code + Codex.
2. Read `README.md`, `CODEX_PROJECT_SPEC.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/CHANGELOG.md`, and `PROMPTS/`.
3. Inspect existing source before changing any code. Preserve the user's actual logo, product references, and **Elegant Garden** theme. The former Soft Blossom theme is obsolete.
4. Run `npm install`, `npm run build`, and `npm run test:assets`. Fix existing errors before advancing.
5. V0.4 in `PROMPTS/V0.4_BUILDER_DRAFTS.md` is implemented and validated locally; review `docs/VALIDATION.md`. Progress to V0.5 and later milestones **only after the preceding version passes validation and required credentials are available**.
6. Do not claim deployment, successful builds, Firebase/Supabase setup, or real 3D fidelity that have not been verified.

## What exists in v0.3

- React + Vite + TypeScript web app: `src/App.tsx`, `src/main.tsx`, `src/styles.css`.
- Procedural bouquet proof-of-concept: `src/features/three/BouquetPreview.tsx` (not final sculpted fuzzy-wire flower models).
- Role-specific login routes `/login`, `/staff/login`, `/admin/login`.
- Firebase and Supabase service scaffolding, **not configured against live projects**.
- Supabase migration draft: `supabase/migrations/0001_foundation.sql`; not deployed.
- Original logo `public/branding/twistfuzz-logo.jpg`, real product reference photos under `public/products/`, original flyers under `public/reference-flyers/`.
- Approved Elegant Garden concept in `docs/elegant-garden-approved-concept.png` and visual campaign assets in `public/campaign/`.
- Promotional lookbook `/lookbook`; check actual implementation.
- Previous project generated protected Vercel preview, but v0.3 source is **not known to be deployed** and a connected GitHub repository does **not** yet exist.

## Source of truth and non-negotiables

Read `CODEX_PROJECT_SPEC.md` for detailed confirmed requirements.
- Brand **TWISTFUZZ**, visual direction **Elegant Garden**, preserve existing logo; follow supplied concept image rather than redesigning into a generic template.
- Official product prices and per-component customizer prices are **PENDING**. Production lead times explicitly **DEFERRED**. Never present guessed prices as real or enable real-money checkout until user confirms them.
- No public Staff/Admin registration. Role enforcement must be backend-based, not routes only.
- Firebase Authentication for all roles; Supabase PostgreSQL as main DB; Vercel frontend.
- No private keys or service-role secrets in the browser or git repository.
- Real world side effects (public publishing, enabling purchases/payments, creating billable resources, modifying active systems) require explicit approval.

## Working style user requested

**Build → Test → Fix → Advance** from one version to the next without needing to re-ask for approval after every successful internal development version. Report critical blockers and pause for permission before external/public/billable/destructive actions.

## Quick local commands

```bash
npm install
npm run dev
npm run build
npm run test:assets
```

The original package arrived without dependencies or credentials. Dependencies are now installed with a tracked `package-lock.json`, and builds/tests have been run locally. No project credentials were added. Use `npm ci` for a fresh install, `npm run check` for the full local gate, and `npm audit` for dependency advisories. Windows PowerShell can use `npm.cmd` when its script policy blocks `npm.ps1`. The historical v0.3 inventory above describes the incoming source; consult the current README and validation report for v0.4 behavior.
