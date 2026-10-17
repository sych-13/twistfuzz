# GitHub and Vercel delivery

The owner authorized GitHub connection and deployment on 2026-10-17 and selected GitHub + Vercel. Destination: `https://github.com/sych-13/twistfuzz` (existing public repository, confirmed empty before the initial upload). Existing Vercel project: `twistfuzz-bloom-preview`, ID `prj_lm9QugJZK1r3W695aS1QTwjKZraE`.

The inner application is the Git repository root. Vercel must use this root, Node 24.x, `npm ci`, `npm run build:preview` and `dist`. The preview build explicitly forces authentication readiness false even if old hosting variables exist. This preserves the unvalidated integration gate while publishing the current UI/local-draft functionality. The private-key build guard remains active. No backend migration, credential provisioning, real payment or commerce activation is part of this delivery.

Vercel's existing project protection was enabled for all deployments when inspected. Do not disable it merely to test. Use authenticated access or an approved share link. The connected Vercel tool can resolve the existing project in its default context; passing its returned account ID explicitly produced a scope 403. Do not assume that explicit-scope error means the default-context project lookup failed.

Pre-upload validation passed: the full local gate (94 Node/DOM/database tests, 2 Deno HTTP tests, both Edge typechecks, production build, 24 original assets, 16 browser tests in 30.0s), plus a deliberate build with all public fixture configuration and readiness set true: the preview build kept portals closed and 2 browser checks passed (6.4s). Audit: 0 vulnerabilities. Evidence: `qa/github-vercel-local-gate-browser-results.json` and `qa/github-vercel-forced-closed-browser-results.json`. The 3D chunk warning remains.

The local directory is linked to the verified existing Vercel project. Initial Git connection failed with Vercel's explicit requirement to add the GitHub Login Connection; the owner reports this is now connected. Retry/verify this after the first repository push. Source credential scanning found only two reviewed literal negative-test fixtures; no recognizable live credentials or ignored build/dependency/secret files were staged. The CLI-created `.env.local` stays ignored and must never be committed.

Source upload succeeded: initial commit `b5816e70df66aa7b0028c5da26b418373f735220` is on `sych-13/twistfuzz/main`. GitHub Login Connection now passes, but linking reports that the Vercel GitHub App must be installed/authorized for this repository. The owner has been given the provider's exact installation link, `https://github.com/apps/vercel`. Automatic Git deployments are not yet confirmed.

First CLI preview `dpl_Ht3kiVrDpNYiS3TuGe5rTsQjfgEk` failed during cloud `npm ci`: the lockfile omitted required optional-tree dependency `@opentelemetry/api@1.9.1`. Local npm's lockfile-only refresh did not repair it. Added that exact version as an explicit development dependency so clean installs include the required record. This is dependency completion, not an application analytics integration. Cloud retry and post-deployment validation remain pending.

## Verified delivery

- GitHub: [sych-13/twistfuzz](https://github.com/sych-13/twistfuzz), branch `main`. Source/dependency-fix commit: `968e57c8fd9c3b39298fc832eb63c234f408a31e`.
- Preview: [open TWISTFUZZ](https://twistfuzz-bloom-preview-8jf46vh0o-icarus9963-7076.vercel.app).
- Deployment: `dpl_6wRnKceqpg9MMrBKBNYbumdS6VRm`, **READY**, Preview, Vite, cloud build **38 seconds**. Metadata confirms the exact source commit/repository. The historical stable production alias has not been updated by this CLI preview.
- Git connection now succeeds after the owner configured Login Connections and the Vercel GitHub App. A separate project API read confirms provider GitHub, owner `sych-13`, repo `twistfuzz`, repository ID `1422224607`, production branch `main`. Future pushes follow this integration's branch deployment behavior; direct Git-triggered delivery is checked separately below when available.
- `npm.cmd ci` now passes locally; full gate passes again after the dependency fix: **94 local tests, 2 Deno HTTP tests, Edge typechecks, build, 24 assets, 16 browser tests (29.7s)**. Audit: **0 vulnerabilities**. Clean-install browser evidence: `qa/github-vercel-clean-install-browser-results.json`.
- **12 hosted checks PASS**: five direct routes, three closed portals, working 3D/local draft save/reload/reopen, disabled checkout, all 24 original image hashes/decoding, five mobile layouts and no browser runtime errors. Evidence: `qa/vercel-deployed-preview-results.json`, `qa/vercel-deployed-home-mobile.png` and `qa/vercel-deployed-studio-mobile.png`. The screenshot capture waits for the deferred studio before recording it.

Hosted verification uses the current project's short-lived development OIDC token, loaded locally without printing it. Only requests to the exact preview origin receive the header. No protection setting was disabled; sign in with the owning Vercel account to view the preview normally. Repeat using `node tests/verify-deployed-preview.mjs https://<this-project-preview-host>/` after refreshing local Vercel development authentication.

This is frontend preview delivery, not live Firebase/Supabase integration or a completed V0.5 release. No operational API, real sign-in, MFA enrollment/recovery, account-backed saved-design flow, price/stock/order/payment integration was activated. Existing business restrictions remain unchanged.

## Confirmed Git-triggered delivery

The documentation/evidence push `c3063c9bf807b7b291ab53cb4f5dde66ab7e8439` automatically triggered Vercel through GitHub. Deployment `dpl_BXAFjTTmhT6oMBwRCE7Xf6mmhBzX` reached **READY**, source **git**, target **production**, in approximately **30 seconds**. Build logs confirm cloning the correct repository/main commit, clean install (0 audit vulnerabilities), Vite and `build:preview`. This updates the hosting production alias; it does not turn the application into a production-ready commerce/auth system.

Stable website: [TWISTFUZZ Bloom Studio](https://twistfuzz-bloom-preview.vercel.app). Exact Git deployment: `https://twistfuzz-bloom-preview-em7b4id3z-icarus9963-7076.vercel.app`. Both the exact deployment homepage and stable `/studio` returned **HTTP 200** through authenticated `vercel curl`; their SPA documents match. Provider metadata confirms the stable alias and commit. The 12 full hosted browser checks above were on the separately identified Preview deployment; do not mislabel those as Production browser tests.

Existing project protection remains enabled. The frontend is static with no deployed application Functions, so this delivery has no application Function runtime/drain validation. Broader production monitoring has not been configured or certified. Final hosting metadata/HTTP evidence is in `qa/vercel-git-delivery-results.json`. Follow-up documentation-only pushes can create later deployments with the same application source.
