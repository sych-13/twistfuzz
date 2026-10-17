export type PortalRole = 'customer' | 'staff' | 'admin';
export type FactorChoice = { uid: string; kind: 'totp' | 'phone'; label: string };

export class AuthFlowError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export function verificationCode(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new AuthFlowError('invalid-code', 'Enter the six-digit verification code.');
  return value;
}

export function authenticationMessage(error: unknown): string {
  if (error instanceof AuthFlowError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  switch (code) {
    case 'auth/invalid-verification-code': case 'auth/invalid-totp-code':
      return 'That verification code was not accepted. Check the latest code and try again.';
    case 'auth/code-expired': case 'auth/invalid-multi-factor-session': case 'auth/multi-factor-session-expired':
    case 'auth/session-expired': case 'auth/invalid-multi-factor-info':
      return 'This verification session has expired. Cancel and sign in again.';
    case 'auth/too-many-requests': case 'auth/quota-exceeded':
      return 'Too many attempts. Please wait before trying again.';
    case 'auth/network-request-failed':
      return 'Check your connection and try again.';
    case 'auth/popup-closed-by-user': case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. You can try again when ready.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': case 'auth/user-disabled':
      return 'Sign-in could not be completed with those details.';
    case 'auth/weak-password':
      return 'Choose a stronger password and try again.';
    case 'auth/email-already-in-use':
      return 'Account creation could not be completed. Try signing in or using password recovery.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/captcha-check-failed':
      return 'The security check was not completed. Try sending the code again.';
    default:
      return 'Sign-in could not be completed. Please try again.';
  }
}

// User/profile fixtures can exercise this policy in tests, but application callers
// always supply real Firebase SDK users and the server role resolver.
export async function verifyPortalAccount<User extends { uid: string; emailVerified: boolean }>(
  user: User, portal: PortalRole,
  services: { refresh: (user: User) => Promise<void>; resolveRole: (user: User) => Promise<PortalRole>; signOutCurrent: (uid: string) => Promise<void>; ensureCustomer?: (user: User) => Promise<void>; isActive?: () => boolean },
): Promise<void> {
  try {
    await services.refresh(user);
    if (services.isActive && !services.isActive()) throw new AuthFlowError('cancelled', 'Sign-in was cancelled.');
    if (!user.emailVerified) throw new AuthFlowError('email-unverified', 'Verify your email first, then sign in again.');
    if (portal === 'customer' && services.ensureCustomer) {
      try { await services.ensureCustomer(user); }
      catch { throw new AuthFlowError('customer-setup-unavailable', 'Your account setup could not be completed. Please try again later.'); }
    }
    if (services.isActive && !services.isActive()) throw new AuthFlowError('cancelled', 'Sign-in was cancelled.');
    let role: PortalRole;
    try { role = await services.resolveRole(user); }
    catch { throw new AuthFlowError('role-unavailable', 'Your portal access could not be verified. Please try again later.'); }
    if (services.isActive && !services.isActive()) throw new AuthFlowError('cancelled', 'Sign-in was cancelled.');
    if (role !== portal) throw new AuthFlowError('wrong-portal', `This account is not authorized for the ${portal} portal.`);
  } catch (error) {
    // Failed portal verification must not leave a newly authenticated session behind.
    try { await services.signOutCurrent(user.uid); } catch { /* No portal is granted even if local sign-out fails. */ }
    throw error;
  }
}

// Invalidating a run prevents late SDK callbacks from navigating after cancel,
// a method change or a portal unmount. It does not pretend to cancel Firebase I/O.
export function operationGuard() {
  let generation = 0;
  return {
    begin() { const current = ++generation; return () => current === generation; },
    invalidate() { generation++; },
  };
}
