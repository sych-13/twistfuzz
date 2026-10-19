# Shared backend request limits

Dev.7 implements a database-backed allowance shared by role verification, Customer provisioning and saved designs. Application readiness stays disabled while full integration controls remain incomplete.

Requests that pass method/origin/body checks first consume a global allowance before JWT verification. After a valid project-pinned signature and identity claims, a second allowance uses only the verified UID. Current-account reads, role resolution, audit/provisioning and design operations happen after both checks. Unverified claim fields, browser roles and forwarded-IP headers never select identity buckets.

| Scope | Server-owned capacity | Window |
| --- | --- | --- |
| Global, all three functions and instances | 600 accepted attempts | 60 seconds from the first admitted request |
| Verified UID, shared across all three functions | 60 accepted attempts | 60 seconds from that identity's first admitted request |

This is a fixed window per bucket, not a rolling-window guarantee: requests around a reset boundary can form a larger burst. Global allowances are consumed even when subsequent JWT or identity checks fail. This caps expensive work but can be exhausted by an attacker; it is not comprehensive DDoS protection. Request parsing and the counter RPC itself still require resources. Provider/gateway abuse controls and realistic multi-session load remain activation requirements.

`public.consume_request_allowance` is SECURITY INVOKER with an empty search path, service-role-only execution and an exact enabled-project check. Its private table has forced RLS and no browser grants. Atomic `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` checks capacity under a row lock. Limits and clock are database-owned; no caller limit/time parameters exist. Rejected requests do not extend the window or increase the count. No identity rows are created for invalid JWTs.

The runtime uses a bounded three-second RPC and one-second database lock wait, without retries or permissive fallback. An RPC failure, missing dependency or malformed decision denies access with 503. Exhausted capacity returns 429, a bounded `Retry-After` and exact-origin CORS. No account mutation is automatically retried. A timeout can still consume an allowance if the server committed before the response was lost; this is deliberately conservative.

Only project-scoped SHA-256 UID hashes are stored, with count/expiry; no emails, tokens, IPs or raw UIDs. Up to 100 entries expired for over 24 hours are removed opportunistically on each active request with `SKIP LOCKED`. Idle systems can retain expired hashes until traffic resumes; this is not a scheduled 24-hour deletion guarantee. No paid cache, extension or cron service was added.

Tests use locally generated fixture keys only inside test adapters. `tests/rate-limits-hosted.sql` checks the real service-role function inside one transaction and rolls back all temporary configuration/counters. It refuses enabled/populated state. It does not establish simultaneous-session performance or a real authenticated end-to-end gateway flow.

References: [PostgreSQL atomic ON CONFLICT behavior](https://www.postgresql.org/docs/17/sql-insert.html), [Supabase function limits](https://supabase.com/docs/guides/functions/limits), [Supabase internal call limits](https://supabase.com/docs/guides/functions/recursive-functions). Internal function-to-function limits do not cover inbound application requests. Current changelog review included [TLS cipher deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) and [PostgreSQL 17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes); this limiter uses built-in SHA-256, without legacy encryption or the affected index/operator features.
