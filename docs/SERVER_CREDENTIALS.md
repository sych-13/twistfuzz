# Development server credentials

Updated 2026-10-18 (Asia/Manila). This documents configuration, not credential values.

The approved Firebase project is `twistfuzz-dev-sych13`; Supabase project is `xoitxpoqejpprjyejgjv`. Supabase CLI authentication was verified by a successful project-list read. The earlier interactive login failed because the CLI selected JSON/agent mode; explicit `--agent no --output-format text` allowed normal browser login. Never print raw CLI authentication JSON or copy connector credentials.

## Runtime identity

Dedicated service account: `twistfuzz-runtime@twistfuzz-dev-sych13.iam.gserviceaccount.com`.

Its only project IAM binding is the custom role `projects/twistfuzz-dev-sych13/roles/twistfuzzRuntimeIdentity`, with exactly `firebaseauth.users.get` and `firebaseauth.users.update`. It reads current account/revocation state and sets the fixed transport claim. It cannot create users. These permissions can update other user properties too; the runtime code exposes only the reviewed claim operation. Treat this credential as sensitive and restrict secret-store access.

The service-account JSON is stored only in Supabase server secrets. It was held in memory and a temporary environment file outside the workspace during upload; that file was deleted. No private key is in the frontend, repository, QA evidence or chat. The first credential failed immediate validation and was revoked; only a subsequently validated credential was uploaded. Disposable permission-test accounts were deleted and absence checked.

Configured secret names: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `TWISTFUZZ_AUTH_ENABLED`, `TWISTFUZZ_ALLOWED_ORIGINS`. The readiness value remains **false**. Allowed origins are the stable protected Vercel site, localhost:5173 and 127.0.0.1:5173. Supabase supplies its database server credentials; they must never be copied into a client variable.

Actual evidence: [nine permission/storage/cleanup checks](qa/backend-setup-server-secrets.json). Firebase billing remained disabled. Initial Admin provisioning must use a separate trusted owner process, never this restricted runtime account or a public privileged signup route.

## Rotation and incident procedure

Use the owner's normal Google authorization and Supabase CLI login. Do not retrieve a private credential through logging or a debug dump.

1. Keep application readiness closed during rotation until the replacement is verified. Generate a replacement only for the exact dedicated account above; preserve existing unrelated IAM bindings.
2. Validate the replacement in memory: intended project/account, token exchange, required read/claim operations and denial of user creation. Use disposable fixtures and verify cleanup. Allow credential propagation before interpreting an immediate token-exchange failure; revoke any abandoned key.
3. Upload the validated replacement through a temporary file outside the workspace to the existing server secret name. Remove the file in a finally block, including failure paths. Never pass private JSON as a process argument.
4. Verify the new runtime credential through the actual provider and approved integration checks. Revoke the superseded key through Google IAM, then independently verify its disabled/deleted state. Do not delete unrelated owner/provider keys. Keep evidence to key metadata, result and time; never retain private material.
5. If compromise is suspected, close readiness, revoke the affected key and review IAM/provider/audit activity before reactivation. Project setup or a successful secret upload alone does not certify application integration.

This procedure is documented but a complete deployed rotation drill is still outstanding. Do not mark that release control passed without exercising it.
