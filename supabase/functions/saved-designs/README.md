# Customer saved designs — local V0.5 preparation

This Edge Function is implemented and locally tested, not deployed or live validated. Frontend deployment does not deploy this function or apply its schema. Keep client/server/database readiness disabled until the complete Firebase/Supabase integration, RLS and Admin MFA/recovery gates pass.

`POST /functions/v1/saved-designs` requires a genuine Firebase Bearer token. The shared handler enforces exact-origin CORS, JSON, a 16,000-byte streamed body limit, no-store responses and redacted errors. Identity/signature/project/current account/revocation and current business role are checked on every request. Only active Customers can continue; browser roles/owner IDs are rejected.

| Action | Body fields besides action | Result |
| --- | --- | --- |
| list | optional offset, integer 0–10000 | Up to 25 designs, hasMore |
| get | id, UUID | One owned design |
| create | name, configuration | Newly saved design, revision 1 |
| update | id, expected revision, name, configuration | Owned design with incremented revision |
| delete | id, expected revision | deleted=true |

The JSON field for the expected revision is `revision`. Names are trimmed, 1–80 Unicode code points and contain no control characters. Configurations contain only the current approved flowers/colors/wrappers/ribbons/message-card flag and at most 30 stems. Extra fields (including prices, owners, roles, timestamps or revisions on creates) are rejected. Duplicate stems normalize through the same canonical validator as the Studio. Empty preview designs are allowed, as in the SQL candidate; these records are not orders.

The runtime needs the existing verified server configuration plus server environment `SUPABASE_PUBLISHABLE_KEY` or legacy `SUPABASE_ANON_KEY`. **Do not use a service-role key for design operations.** A new Supabase client is created per verified request with that user's Firebase token and no persisted session. Every query additionally filters the verified owner; RLS and column grants independently apply. Only role/account verification uses the existing server-only auth adapter.

Updates/deletes compare id + verified owner + expected revision in one database operation. Zero affected rows produce the same 409 for stale, missing or another owner's records, without revealing ownership. Gets return generic 404 when inaccessible. Database errors fail closed. Responses whitelist design fields and never include owner identity. Lists use stable created_at/id ordering; offset pages can shift under concurrent creates/deletes, so refresh/reopen before editing and do not treat them as a snapshot.

## Verification and activation limits

`npm.cmd run test:designs` exercises generated RSA fixtures, the actual handler/verifier, real local PostgreSQL/WASM RLS/constraints/revisions, the actual Supabase JS query adapter with a controlled HTTP transport, and component interactions. SQL timestamps in fixtures cross a JSON serialization boundary like PostgREST. Fixture tokens and SQL gateway claims exist only in tests, never application login paths. Provider calls and PostgREST are not real hosted integrations in these tests; genuine simultaneous connections, transport-claim propagation, deployed rate limits and native Firebase trust still require validation.

The existing schema review candidate is unchanged in this version and not a generated/applied migration. Gateway deployment, project/public-key settings, rate limits, provider trust, current account behavior and cross-user SQL/API tests require approved real project access before activation. The project's readiness flag is not a substitute for authorization. As with the other Firebase verifier functions, any approved gateway `verify_jwt=false` setting must be deployed only together with this cryptographic handler, never as an unauthenticated fallback.

The Studio account panel separates browser-local drafts from account records. Opening/deleting requires explicit confirmation; opening fetches current data and will not replace a bouquet edited during the request. Account switches/unmounts invalidate late UI results. Writes are not automatically retried, since a lost network response can leave a successfully committed create; refresh before retrying to avoid duplicates. Repeated create requests intentionally create separate copies; no exactly-once/idempotency guarantee is claimed.
