# GitHub and Vercel delivery

The owner authorized GitHub connection and deployment on 2026-10-17 and selected GitHub + Vercel. Destination: `https://github.com/sych-13/twistfuzz` (existing public repository, confirmed empty before the initial upload). Existing Vercel project: `twistfuzz-bloom-preview`, ID `prj_lm9QugJZK1r3W695aS1QTwjKZraE`.

The inner application is the Git repository root. Vercel must use this root, Node 24.x, `npm ci`, `npm run build:preview` and `dist`. The preview build explicitly forces authentication readiness false even if old hosting variables exist. This preserves the unvalidated integration gate while publishing the current UI/local-draft functionality. The private-key build guard remains active. No backend migration, credential provisioning, real payment or commerce activation is part of this delivery.

Vercel's existing project protection was enabled for all deployments when inspected. Do not disable it merely to test. Use authenticated access or an approved share link. The connected Vercel tool can resolve the existing project in its default context; passing its returned account ID explicitly produced a scope 403. Do not assume that explicit-scope error means the default-context project lookup failed.

Pre-upload validation passed: the full local gate (94 Node/DOM/database tests, 2 Deno HTTP tests, both Edge typechecks, production build, 24 original assets, 16 browser tests in 30.0s), plus a deliberate build with all public fixture configuration and readiness set true: the preview build kept portals closed and 2 browser checks passed (6.4s). Audit: 0 vulnerabilities. Evidence: `qa/github-vercel-local-gate-browser-results.json` and `qa/github-vercel-forced-closed-browser-results.json`. The 3D chunk warning remains.

The local directory is linked to the verified existing Vercel project. Initial Git connection failed with Vercel's explicit requirement to add the GitHub Login Connection; the owner reports this is now connected. Retry/verify this after the first repository push. Source credential scanning found only two reviewed literal negative-test fixtures; no recognizable live credentials or ignored build/dependency/secret files were staged. The CLI-created `.env.local` stays ignored and must never be committed.

Delivery state and post-deployment evidence will be recorded here after pushing and checking the deployment. Until then, no new deployment URL or successful Git integration is claimed.
