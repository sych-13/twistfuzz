import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import { AccessError } from './auth.ts';
import type { AuthDependencies } from './auth.ts';
import { ensureAuthenticatedTransportRole } from './customer.ts';
import type { CustomerProvisioningDependencies } from './customer.ts';
import { createRateLimitConsumer } from './rateLimit.ts';

export type Environment = { get: (name: string) => string | undefined };
const disabled = () => new AccessError(503, 'auth_setup_pending', 'Authentication setup and security validation are pending.');

export function readAllowedOrigins(environment: Environment): string[] {
  return (environment.get('TWISTFUZZ_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(value => {
    try {
      const url = new URL(value);
      return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)));
    } catch { return false; }
  });
}

// Lazy initialization means an unconfigured preview never contacts Firebase or a database.
export function createServerRuntime(environment: Environment): () => CustomerProvisioningDependencies {
  let runtime: CustomerProvisioningDependencies | undefined;
  return () => {
    // This is a server-side release gate, not a browser-asserted permission.
    if (environment.get('TWISTFUZZ_AUTH_ENABLED') !== 'true' || readAllowedOrigins(environment).length === 0) throw disabled();
    if (runtime) return runtime;
    const projectId = environment.get('FIREBASE_PROJECT_ID');
    const accountJson = environment.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    const supabaseUrl = environment.get('SUPABASE_URL');
    const serverKey = environment.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!projectId || !accountJson || !supabaseUrl || !serverKey) throw disabled();
    let serviceAccount;
    try { serviceAccount = JSON.parse(accountJson); }
    catch { throw disabled(); }
    if (!serviceAccount || typeof serviceAccount !== 'object' || Array.isArray(serviceAccount) ||
        serviceAccount.project_id !== projectId || serviceAccount.type !== 'service_account') throw disabled();
    const name = `twistfuzz-${projectId}`;
    const app = getApps().find(item => item.name === name) ?? initializeApp({ projectId, credential: cert(serviceAccount) }, name);
    const firebaseAuth = getAuth(app);
    const database = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const dependencies: AuthDependencies = {
      projectId,
      consumeRateLimit: createRateLimitConsumer(database, projectId),
      async getAccount(uid) {
        try {
          const user = await firebaseAuth.getUser(uid);
          const validAfter = Date.parse(user.tokensValidAfterTime ?? '');
          if (!Number.isFinite(validAfter)) throw new Error('Missing revocation state');
          return { uid: user.uid, email: user.email ?? '', emailVerified: user.emailVerified,
            disabled: user.disabled, validAfter: Math.floor(validAfter / 1000) };
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') return null;
          throw error;
        }
      },
      async getTrustedRole(uid) {
        const { data, error } = await database.rpc('resolve_business_role', { p_uid: uid, p_project_id: projectId }).maybeSingle();
        if (error) throw new Error('Role lookup unavailable');
        return (data as { role?: unknown } | null)?.role ?? null;
      },
      async auditPrivilegedAccess(uid, role) {
        const { error } = await database.from('audit_events').insert({ actor_uid: uid, action: 'portal.access_verified',
          target_id: uid, details: { role } });
        if (error) throw new Error('Audit write unavailable');
      },
    };
    runtime = {
      auth: dependencies,
      async provisionCustomer(identity) {
        const { data, error } = await database.rpc('provision_customer_profile', {
          p_uid: identity.uid, p_email: identity.email, p_project_id: projectId,
        }).single();
        if (error?.code === '42501') throw new AccessError(403, 'customer_access_denied', 'This account cannot be registered through the Customer portal.');
        if (error || !data) throw new Error('Customer provisioning unavailable');
        const profile = data as { firebase_uid: string; role: unknown; is_active: boolean };
        return { uid: profile.firebase_uid, role: profile.role, active: profile.is_active };
      },
      async ensureTransportRole(uid) {
        await ensureAuthenticatedTransportRole(uid, {
          readClaims: async identityUid => (await firebaseAuth.getUser(identityUid)).customClaims,
          writeClaims: async (identityUid, claims) => firebaseAuth.setCustomUserClaims(identityUid, claims),
          async audit(identityUid, phase) {
            const { error } = await database.from('audit_events').insert({ actor_uid: identityUid,
              action: `identity.transport_role_${phase}`, target_id: identityUid, details: { role: 'authenticated' } });
            if (error) throw new Error('Transport role audit unavailable');
          },
        });
      },
    };
    return runtime;
  };
}

export function createDependencies(environment: Environment): () => AuthDependencies {
  const runtime = createServerRuntime(environment);
  return () => runtime().auth;
}
