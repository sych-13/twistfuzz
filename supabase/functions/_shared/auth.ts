import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

export type Role = 'customer' | 'staff' | 'admin';
export class AccessError extends Error {
  status: number;
  code: string;
  retryAfterSeconds?: number;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

// This URL is fixed by the server. Never fetch a jku/x5u URL supplied by a token.
export const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const firebaseKeys = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL), { timeoutDuration: 5000 });
export type VerifiedIdentity = {
  uid: string; email: string; authTime: number; provider: 'password' | 'google.com'; secondFactor: string | null;
};
export type AccountSecurity = { uid: string; email: string; emailVerified: boolean; disabled: boolean; validAfter: number };
export type AuthDependencies = {
  projectId: string;
  getKey?: JWTVerifyGetKey;
  now?: () => Date;
  consumeRateLimit: (scope: 'global' | 'identity', uid?: string) => Promise<unknown>;
  getAccount: (uid: string) => Promise<AccountSecurity | null>;
  getTrustedRole: (uid: string) => Promise<unknown>;
  auditPrivilegedAccess: (uid: string, role: 'staff' | 'admin') => Promise<void>;
};
const unauthorized = () => new AccessError(401, 'invalid_identity', 'Sign in again with a verified account.');
const unavailable = () => new AccessError(503, 'identity_service_unavailable', 'Account verification is temporarily unavailable.');

async function enforceRateLimit(dependencies: AuthDependencies, scope: 'global' | 'identity', uid?: string): Promise<void> {
  let decision: unknown;
  try { decision = await dependencies.consumeRateLimit(scope, uid); }
  catch { throw new AccessError(503, 'rate_limit_unavailable', 'Request protection is temporarily unavailable.'); }
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new AccessError(503, 'rate_limit_unavailable', 'Request protection is temporarily unavailable.');
  }
  const { allowed, retry_after_seconds: retry } = decision as Record<string, unknown>;
  if (allowed === true && retry === 0) return;
  if (allowed !== false || !Number.isSafeInteger(retry) || (retry as number) < 1 || (retry as number) > 60) {
    throw new AccessError(503, 'rate_limit_unavailable', 'Request protection is temporarily unavailable.');
  }
  const error = new AccessError(429, 'rate_limited', 'Too many requests. Please wait before trying again.');
  error.retryAfterSeconds = retry as number;
  throw error;
}

async function verifyLimitedIdentity(token: string, dependencies: AuthDependencies): Promise<VerifiedIdentity> {
  // The global allowance bounds signature/provider work across every instance.
  // Never use a decoded, unverified UID or a caller-provided IP as a bucket key.
  await enforceRateLimit(dependencies, 'global');
  const identity = await verifyFirebaseToken(token, dependencies);
  await enforceRateLimit(dependencies, 'identity', identity.uid);
  return identity;
}

export async function verifyFirebaseToken(token: string, dependencies: Pick<AuthDependencies, 'projectId' | 'getKey' | 'now'>): Promise<VerifiedIdentity> {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(dependencies.projectId)) throw unavailable();
  if (token.length > 16000 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw unauthorized();
  const now = dependencies.now?.() ?? new Date();
  try {
    const { payload, protectedHeader } = await jwtVerify(token, dependencies.getKey ?? firebaseKeys, {
      algorithms: ['RS256'], issuer: `https://securetoken.google.com/${dependencies.projectId}`,
      audience: dependencies.projectId, currentDate: now, clockTolerance: 0,
      requiredClaims: ['sub', 'exp', 'iat', 'auth_time', 'email', 'email_verified', 'firebase'],
    });
    const seconds = Math.floor(now.getTime() / 1000);
    if (typeof protectedHeader.kid !== 'string' || !protectedHeader.kid || protectedHeader.kid.length > 128 ||
        protectedHeader.jku || protectedHeader.jwk || protectedHeader.x5u ||
        (protectedHeader.typ && protectedHeader.typ !== 'JWT')) throw unauthorized();
    if (payload.aud !== dependencies.projectId || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
        typeof payload.email !== 'string' || !payload.email || payload.email_verified !== true ||
        !Number.isSafeInteger(payload.iat) || payload.iat! < 0 || payload.iat! > seconds ||
        !Number.isSafeInteger(payload.auth_time) || (payload.auth_time as number) < 0 ||
        (payload.auth_time as number) > payload.iat! || !Number.isSafeInteger(payload.exp) || payload.exp! <= payload.iat!) throw unauthorized();
    const firebase = payload.firebase;
    if (!firebase || typeof firebase !== 'object' || Array.isArray(firebase)) throw unauthorized();
    const claims = firebase as Record<string, unknown>;
    // Tenant and custom/anonymous provider support is deliberately closed until explicitly configured.
    if (claims.tenant !== undefined || !['password', 'google.com'].includes(claims.sign_in_provider as string)) throw unauthorized();
    const secondFactor = claims.sign_in_second_factor;
    if (secondFactor !== undefined && !['totp', 'phone'].includes(secondFactor as string)) throw unauthorized();
    return { uid: payload.sub, email: payload.email, authTime: payload.auth_time as number,
      provider: claims.sign_in_provider as VerifiedIdentity['provider'], secondFactor: typeof secondFactor === 'string' ? secondFactor : null };
  } catch (error) {
    if (error instanceof AccessError) throw error;
    // Do not return JWTs, claims or provider error details to callers.
    throw unauthorized();
  }
}

function validateCurrentAccount(identity: VerifiedIdentity, account: AccountSecurity | null): void {
  if (!account || account.uid !== identity.uid || account.disabled || !account.emailVerified ||
      account.email !== identity.email) throw unauthorized();
  if (!Number.isSafeInteger(account.validAfter) || account.validAfter < 0) throw unavailable();
  if (identity.authTime < account.validAfter) throw new AccessError(401, 'session_revoked', 'This session was revoked. Sign in again.');
}

export async function verifyCurrentIdentity(token: string, dependencies: AuthDependencies): Promise<VerifiedIdentity> {
  const identity = await verifyLimitedIdentity(token, dependencies);
  let account: AccountSecurity | null;
  try { account = await dependencies.getAccount(identity.uid); }
  catch { throw unavailable(); }
  validateCurrentAccount(identity, account);
  return identity;
}

export async function authenticate(token: string, dependencies: AuthDependencies): Promise<{ identity: VerifiedIdentity; role: Role }> {
  const identity = await verifyLimitedIdentity(token, dependencies);
  let account: AccountSecurity | null;
  let trustedRole: unknown;
  try { [account, trustedRole] = await Promise.all([dependencies.getAccount(identity.uid), dependencies.getTrustedRole(identity.uid)]); }
  catch { throw unavailable(); }
  validateCurrentAccount(identity, account);
  // A signed JWT's role/user_metadata is never the business-role authority.
  if (!['customer', 'staff', 'admin'].includes(trustedRole as string)) {
    throw new AccessError(403, 'account_not_provisioned', 'This account has not been authorized for a portal.');
  }
  const role = trustedRole as Role;
  if (role !== 'customer' && identity.provider !== 'password') {
    throw new AccessError(403, 'password_required', 'Staff and Admin accounts must use email and password.');
  }
  if (role === 'admin' && !identity.secondFactor) {
    throw new AccessError(403, 'mfa_required', 'Admin access requires a completed multi-factor sign-in.');
  }
  if (role !== 'customer') {
    try { await dependencies.auditPrivilegedAccess(identity.uid, role); }
    catch { throw new AccessError(503, 'audit_unavailable', 'Privileged access could not be recorded. Try again later.'); }
  }
  return { identity, role };
}
