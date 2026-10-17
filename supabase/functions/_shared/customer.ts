import { AccessError, verifyCurrentIdentity } from './auth.ts';
import type { AuthDependencies, VerifiedIdentity } from './auth.ts';

export type CustomerProvisioningDependencies = {
  auth: AuthDependencies;
  provisionCustomer: (identity: VerifiedIdentity) => Promise<{ uid: string; role: unknown; active: boolean }>;
  ensureTransportRole: (uid: string) => Promise<void>;
};

export async function provisionVerifiedCustomer(token: string, dependencies: CustomerProvisioningDependencies): Promise<void> {
  const identity = await verifyCurrentIdentity(token, dependencies.auth);
  const profile = await dependencies.provisionCustomer(identity);
  if (profile.uid !== identity.uid || profile.role !== 'customer' || !profile.active) {
    throw new AccessError(403, 'customer_access_denied', 'This account cannot be registered through the Customer portal.');
  }
  // This is the fixed Postgres transport role, never a TWISTFUZZ business role.
  await dependencies.ensureTransportRole(identity.uid);
  if (await dependencies.auth.getTrustedRole(identity.uid) !== 'customer') {
    throw new AccessError(403, 'customer_access_denied', 'Customer access is no longer available for this account.');
  }
}

export async function ensureAuthenticatedTransportRole(
  uid: string, services: {
    readClaims: (uid: string) => Promise<Record<string, unknown> | undefined>;
    writeClaims: (uid: string, claims: Record<string, unknown>) => Promise<void>;
    audit: (uid: string, phase: 'requested' | 'verified') => Promise<void>;
  },
): Promise<void> {
  const claims = await services.readClaims(uid) ?? {};
  if (claims.role === 'authenticated') { await services.audit(uid, 'verified'); return; }
  if (claims.role !== undefined) throw new AccessError(409, 'transport_role_conflict', 'Account setup requires administrator review.');
  // The trusted provisioning process must own custom-claim writes. Existing claims
  // are preserved; conflicting transport roles are never silently downgraded.
  await services.audit(uid, 'requested');
  await services.writeClaims(uid, { ...claims, role: 'authenticated' });
  if ((await services.readClaims(uid))?.role !== 'authenticated') {
    throw new AccessError(503, 'transport_verification_failed', 'Account setup could not be verified. Try again later.');
  }
  await services.audit(uid, 'verified');
}
