# Authentication and recovery — V0.5 preparation

This records the implemented client boundary and the remaining release requirements. It is not evidence of configured Firebase providers, enrolled factors or a functioning production recovery process.

## Implemented client flow

1. The configured Firebase SDK performs email/password sign-in, or Customer-only Google Sign-In. Unconfigured previews do not initialize an auth client or accept credentials.
2. A genuine Firebase `auth/multi-factor-auth-required` response opens the challenge using only enrolled hints returned by Firebase. No URL, local-storage role, form value or mock account can create portal access.
3. The user selects an enrolled authenticator or phone. Authenticator entry requires six digits. Phone entry stays disabled until the real SDK completes its reCAPTCHA and code-send request. The UI never claims that a code was sent on a failed request.
4. Firebase validates the factor assertion. Codes are cleared from component state on submit, method change or cancellation; challenge resolvers and SMS verification IDs stay in memory and are discarded on completion/unmount/cancel.
5. The app refreshes the authenticated Firebase user/token and requests the trusted server role. A wrong portal, unverified email or failed role lookup denies navigation and signs out the newly authenticated session. Late results cannot navigate after cancellation or unmount.
6. The server independently verifies project, signature, claims, live account/revocation state, trusted database role and MFA before returning access. Staff/Admin use password sign-in; Admin requires a completed supported second factor. A successful client screen alone grants nothing.

Tests use generated identities or component callback fixtures only in the test process. The static MFA visual fixture under `docs/qa/` has no authentication handlers and is not included in `public/` or `dist/`.

## Required configuration and live validation

- Firebase Authentication with Identity Platform, approved providers, authorized domains, email verification and email-enumeration protection must be configured and verified for the intended project. TOTP and SMS provider availability, quotas and billing require review before enabling them.
- Run real success/failure/retry/expiry/cancel tests for each enabled factor, including reCAPTCHA failures, SMS throttling and token refresh. Verify no dashboard is granted before both Firebase and backend checks complete.
- Test changes of user/portal during pending SDK requests; test account disable/revocation and removal/replacement of factors. Unit/DOM tests do not certify these provider interactions.
- Every operational endpoint still needs current identity, role and ownership checks; the role endpoint is not a session-wide permission grant.

## Owner enrollment and recovery gate

Owner enrollment is **not implemented as a public first-factor-only setup route**. The first Admin must be provisioned by a trusted server/owner process and enroll approved factors before receiving normal Admin portal access. Do not add a temporary MFA skip, a role in local storage, an environment switch that grants Admin, or a public endpoint that removes factors.

Before enabling V0.5, establish and exercise an owner recovery process independent of the lost factor and primary password. Configure independently protected recovery material or an additional approved enrolled method where supported, and document the responsible owner and private recovery procedure. Recovery must preserve mandatory MFA, revoke affected sessions, audit sensitive actions, and require fresh authenticated MFA before returning to privileged work. No recovery secret should enter browser storage, source files, screenshots or logs.

If all enrolled methods are lost, the interface directs the owner to that pre-established process. It does not turn password reset into Admin access. A real, tested recovery procedure is still a blocker; this document does not substitute for one.

## Staff and Customer recovery

- Staff portals expose no public signup or password-reset form. Account provisioning and assisted recovery remain the administrator's responsibility.
- Customer portals offer the Firebase password-reset flow with generic feedback. Existing MFA enrollment must still be honored when signing in after a reset.
- **Provider-level recovery behavior remains to be validated.** Hiding a Staff/Admin reset button does not by itself prevent direct calls to Firebase's public password-recovery APIs. The intended staff account/email management and recovery controls must be evaluated against that behavior before claiming the assisted-recovery requirement is enforced.

Official references: [Firebase TOTP MFA](https://firebase.google.com/docs/auth/web/totp-mfa), [Firebase web MFA and reCAPTCHA](https://firebase.google.com/docs/auth/web/multi-factor), and [Firebase token revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).
