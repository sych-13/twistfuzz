# V0.5 database access candidate

`supabase/schema-drafts/auth_design_access.sql` is a local review candidate layered over the original `0001_foundation.sql`. It is **not a generated/deployed migration**. Nothing has been applied to a hosted database. Keep the original foundation and this candidate together when reviewing the proposed schema.

## Trust and access

| Role / object | Allowed behavior |
| --- | --- |
| Anonymous | No access to application database tables or provisioning RPC. Existing static product references remain available in the frontend. |
| Authenticated Customer | Read own active profile; create/read/update/delete own saved bouquet records. Profile roles, activation and audit writes are unavailable. |
| Staff / Admin | Read own active profile; no Customer saved-design access. Operational/privileged endpoints still need separate backend permissions and Admin MFA. |
| Trusted server | Read/provision profiles, act on designs with explicit verified identity/ownership, and append audit events. Service credentials never belong in the browser. |

The gateway must verify Firebase signatures and accept only the intended registered Firebase project. The native integration assigns the Postgres transport claim **`role: authenticated`**; it must never use a submitted business role or expose `service_role`. TWISTFUZZ business roles come from the current trusted `profiles` row.

Policy helpers additionally require the configured issuer/audience, verified email, supported provider, valid timestamps, a nonempty text UID, no unsupported tenant and an enabled project configuration. They use `SECURITY INVOKER`, explicit schema names and an empty function search path. Firebase UIDs are text; no UUID-only `auth.uid()` assumption is made.

Ownership is enforced by both permissive and restrictive `USING`/`WITH CHECK` policies, so an accidental extra permissive policy cannot expand Customer ownership. Profile write denials also remain restrictive. Column grants prevent changes to a design's identity, revision or timestamps. Database constraints validate bouquet options, quantities, total stems, payload shape and size; no price/permission metadata is accepted in a configuration.

`app_private.auth_configuration` starts with no Firebase project and `integration_enabled=false`. It contains only public project/readiness settings, not credentials. Authenticated callers can read these settings but cannot change them. **Do not expose `app_private` as a Data API schema.** The candidate grants no Customer catalog/audit access and leaves original official component prices NULL.

## Saved-design data

The proposed `custom_designs` additions are `name`, `updated_at` and a server-maintained `revision`. A trigger preserves identity and increments revisions on updates. The locally implemented `saved-designs` endpoint requires an expected revision for update/delete, includes owner identity in every data operation and reports a generic conflict for stale/inaccessible records. Its request-scoped public-key/user-token client retains RLS. The Studio account panel uses this contract. Neither the endpoint nor schema has been deployed/live validated; see `supabase/functions/saved-designs/README.md`.

The database bouquet validator is deliberately strict: only flowers, wrapper, ribbon and the existing message-card option are stored. Its option parity is tested against all 390 combinations from the current frontend model. Later approved schema/options must update both validators and their compatibility rules. These records are saved designs, not orders or stock reservations, and do not assert price/inventory availability.

## Internal Customer provisioning

`public.provision_customer_profile(uid,email,project_id)` is executable only by the trusted server role. It requires the matching enabled project configuration, takes no role parameter, inserts only `customer`, never overwrites an existing profile and refuses Staff/Admin or deactivated profiles. Creation and its audit event occur in one transaction; an audit failure rolls back creation. Repeated successful calls are idempotent. The companion service-only `resolve_business_role(uid,project_id)` returns only the current active role under that same enabled project pin.

The implemented `provision-customer` HTTP endpoint derives UID/email from a cryptographically verified token and the current Firebase account, never from submitted form fields. The SQL function does not independently authenticate those arguments; its server-only EXECUTE permission is part of the boundary. Transport-claim setup uses trusted Firebase Admin code with pre-write/read-back audits, then the client refreshes its token and resolves its business role. SQL/Firebase operations are not a distributed transaction; provider failure may leave an audited Customer profile for an idempotent retry. Coordinate concurrent claim writers before activation. See `supabase/functions/provision-customer/README.md`. No public Staff/Admin provisioning or reactivation endpoint is implemented; all live readiness gates remain disabled.

## Local verification and limits

`npm.cmd run test:database` starts an in-memory **PGlite/PostgreSQL** instance, loads the unmodified foundation (including pgcrypto) and the candidate, creates disposable SQL roles, and exercises actual PostgreSQL grants, constraints, triggers, transactions and RLS. It requires no Docker, credentials, connection URL or network database. Versioned TAP output is retained in `docs/qa/`.

The test-only `auth.jwt()` function reads a simulated gateway claims context. Test fixtures intentionally exercise valid and invalid contexts; they are not an app authentication path and are not shipped in the frontend/Edge Functions. Signature verification is covered independently by the actual JOSE verifier tests.

These tests do **not** certify hosted Supabase gateway behavior, PostgREST grants/exposed-schema configuration, the intended deployed Postgres version, genuine concurrent sessions, Firebase revocation checks, provider MFA or deployed rate limits. A signed token's account state can change before expiry: direct Data API policies check profile activation/current business role, while protected server endpoints must also perform current Firebase account/revocation checks.

## Gate before a real migration or activation

1. Obtain approval/access to the intended development projects; inspect existing data and configured Postgres/API versions without assuming this candidate matches them.
2. Review schema/security choices, existing draft compatibility and provider recovery controls. Do not delete invalid historical data merely to make constraints pass.
3. Iterate in an approved local/full Supabase environment, run database/security advisors, and create/generate a migration through the Supabase CLI workflow. This candidate must not be silently applied as a production migration.
4. Configure the registered Firebase trust integration, the fixed transport claim, exact project settings, explicit table grants and Data API exposure. Test real users with distinct text UIDs, wrong projects, disabled/revoked identities, Staff/Admin restrictions and audit persistence.
5. Validate owner MFA enrollment/recovery and rate limits. Only then activate the server/client/database readiness gates. Live payments and public deployment remain separately prohibited without approval.

References: [Supabase Firebase integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL policies](https://www.postgresql.org/docs/current/sql-createpolicy.html), and [PGlite](https://pglite.dev/docs/).
