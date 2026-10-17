import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AccessError } from '../supabase/functions/_shared/auth.ts';
import { ensureAuthenticatedTransportRole } from '../supabase/functions/_shared/customer.ts';
import { createCustomerProvisioningHandler } from '../supabase/functions/provision-customer/handler.ts';
import { createServerRuntime } from '../supabase/functions/_shared/runtime.ts';
import { asRole, fixtureProject, localDatabase } from './helpers/database.mjs';

const keys = await generateKeyPair('RS256', { extractable: true });
const getKey = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'provision-fixture', alg: 'RS256' }] });
const seconds = 1792195200;
const accounts = new Map();
const claims = new Map();
let database;
before(async () => {
  database = (await localDatabase()).database;
  await database.query('update app_private.auth_configuration set firebase_project_id=$1,integration_enabled=true', [fixtureProject]);
  for (const [uid, role, active] of [['fixture-staff', 'staff', true], ['fixture-admin', 'admin', true], ['fixture-inactive', 'customer', false]]) {
    await database.query('insert into public.profiles(firebase_uid,email,role,is_active) values($1,$2,$3,$4)', [uid, `${uid}@example.invalid`, role, active]);
  }
});
after(async () => database?.close());

async function token(uid, changes = {}) {
  return new SignJWT({ sub: uid, email: `${uid}@example.invalid`, email_verified: true,
    iss: `https://securetoken.google.com/${fixtureProject}`, aud: fixtureProject, iat: seconds - 5,
    exp: seconds + 3500, auth_time: seconds - 60, firebase: { sign_in_provider: 'password' }, ...changes })
    .setProtectedHeader({ alg: 'RS256', kid: 'provision-fixture' }).sign(keys.privateKey);
}
function dependencies() {
  return {
    auth: {
      projectId: fixtureProject, getKey, now: () => new Date(seconds * 1000),
      getAccount: async uid => accounts.has(uid) ? accounts.get(uid) : { uid, email: `${uid}@example.invalid`, emailVerified: true, disabled: false, validAfter: 0 },
      getTrustedRole: async uid => (await asRole(database, 'service_role', {}, db => db.query('select * from public.resolve_business_role($1,$2)', [uid, fixtureProject]))).rows[0]?.role ?? null,
      auditPrivilegedAccess: async () => {},
    },
    async provisionCustomer(identity) {
      try {
        const result = await asRole(database, 'service_role', {}, db => db.query('select * from public.provision_customer_profile($1,$2,$3)', [identity.uid, identity.email, fixtureProject]));
        const row = result.rows[0];
        return { uid: row.firebase_uid, role: row.role, active: row.is_active };
      } catch (error) {
        if (error.code === '42501') throw new AccessError(403, 'customer_access_denied', 'Customer access denied.');
        throw error;
      }
    },
    async ensureTransportRole(uid) {
      await ensureAuthenticatedTransportRole(uid, {
        readClaims: async value => claims.get(value),
        writeClaims: async (value, next) => { claims.set(value, next); },
        audit: async (value, phase) => { await asRole(database, 'service_role', {}, db => db.query('insert into public.audit_events(actor_uid,action,target_id) values($1,$2,$1)', [value, `identity.transport_role_${phase}`])); },
      });
    },
  };
}
function request(bearer, body = {}) {
  return new Request('https://edge.example.invalid/provision-customer', { method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const handler = (value = dependencies()) => createCustomerProvisioningHandler({ allowedOrigins: ['http://127.0.0.1:5173'], dependencies: () => value });

test('verified onboarding derives its Customer identity from the signed token and audits real SQL creation', async () => {
  const uid = 'verified-new-customer';
  const response = await handler()(request(await token(uid, { user_metadata: { role: 'admin' } })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { role: 'customer', refreshToken: true });
  assert.deepEqual((await database.query('select firebase_uid,email,role,is_active from public.profiles where firebase_uid=$1', [uid])).rows,
    [{ firebase_uid: uid, email: `${uid}@example.invalid`, role: 'customer', is_active: true }]);
  assert.deepEqual(claims.get(uid), { role: 'authenticated' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const events = (await database.query('select action from public.audit_events where actor_uid=$1 order by id', [uid])).rows.map(row => row.action);
  assert.deepEqual(events, ['profile.customer_provisioned', 'identity.transport_role_requested', 'identity.transport_role_verified']);
});

test('repeated onboarding never duplicates or promotes an existing Customer profile', async () => {
  const uid = 'repeat-customer';
  const bearer = await token(uid);
  for (let index = 0; index < 2; index++) assert.equal((await handler()(request(bearer))).status, 200);
  assert.equal((await database.query('select count(*)::integer as count from public.profiles where firebase_uid=$1', [uid])).rows[0].count, 1);
  assert.equal((await database.query("select count(*)::integer as count from public.audit_events where actor_uid=$1 and action='profile.customer_provisioned'", [uid])).rows[0].count, 1);
});

test('unverified, disabled, deleted and revoked identities create no profile or transport claim', async () => {
  const invalidAccounts = [null, { emailVerified: false }, { disabled: true }, { validAfter: seconds - 30 }];
  for (const [index, changes] of invalidAccounts.entries()) {
    const uid = `denied-customer-${index}`;
    accounts.set(uid, changes === null ? null : { uid, email: `${uid}@example.invalid`, emailVerified: true, disabled: false, validAfter: 0, ...changes });
    assert.equal((await handler()(request(await token(uid)))).status, 401);
    assert.equal((await database.query('select firebase_uid from public.profiles where firebase_uid=$1', [uid])).rows.length, 0);
    assert.equal(claims.has(uid), false);
  }
});

test('wrong project, expired and unverified token claims cannot reach provisioning', async () => {
  let created = 0;
  const deps = { ...dependencies(), provisionCustomer: async () => { created++; throw Error(); } };
  for (const changes of [{ aud: 'another-project' }, { exp: seconds - 1 }, { email_verified: false }]) {
    assert.equal((await handler(deps)(request(await token('invalid-token-customer', changes)))).status, 401);
  }
  assert.equal(created, 0);
});

test('Staff, Admin and inactive profiles cannot be overwritten through Customer onboarding', async () => {
  for (const uid of ['fixture-staff', 'fixture-admin', 'fixture-inactive']) {
    const original = (await database.query('select role,is_active,email from public.profiles where firebase_uid=$1', [uid])).rows[0];
    assert.equal((await handler()(request(await token(uid)))).status, 403);
    assert.deepEqual((await database.query('select role,is_active,email from public.profiles where firebase_uid=$1', [uid])).rows[0], original);
    assert.equal(claims.has(uid), false);
  }
});

test('caller identity/role fields and oversized bodies are rejected before provisioning', async () => {
  const uid = 'body-override-customer';
  const bearer = await token(uid);
  for (const body of [{ uid: 'victim' }, { email: 'victim@example.invalid' }, { role: 'admin' }, { owner_uid: 'victim' }]) {
    assert.equal((await handler()(request(bearer, body))).status, 400);
  }
  assert.equal((await handler()(request(bearer, { padding: 'x'.repeat(513) }))).status, 413);
  assert.equal((await database.query('select firebase_uid from public.profiles where firebase_uid=$1', [uid])).rows.length, 0);
});

test('Google verified customers can provision only the same fixed Customer role', async () => {
  const uid = 'google-customer';
  const response = await handler()(request(await token(uid, { firebase: { sign_in_provider: 'google.com' } })));
  assert.equal(response.status, 200);
  assert.equal((await database.query('select role from public.profiles where firebase_uid=$1', [uid])).rows[0].role, 'customer');
});

test('claim-write failure reports an error and retry completes the existing audited profile', async () => {
  const uid = 'retry-claim-customer';
  const deps = { ...dependencies(), ensureTransportRole: async () => { throw Error('private provider detail'); } };
  const failed = await handler(deps)(request(await token(uid)));
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('private'), false);
  assert.equal((await handler()(request(await token(uid)))).status, 200);
  assert.equal((await database.query("select count(*)::integer as count from public.audit_events where actor_uid=$1 and action='profile.customer_provisioned'", [uid])).rows[0].count, 1);
});

test('a changed role before completion prevents a successful onboarding response', async () => {
  const uid = 'role-changed-customer';
  const deps = dependencies();
  const original = deps.ensureTransportRole;
  deps.ensureTransportRole = async value => { await original(value); await database.query("update public.profiles set role='staff' where firebase_uid=$1", [value]); };
  assert.equal((await handler(deps)(request(await token(uid)))).status, 403);
});

test('disabled runtime returns 503 without starting an external account or database client', async () => {
  const response = await createCustomerProvisioningHandler({ allowedOrigins: ['http://127.0.0.1:5173'], dependencies: createServerRuntime({ get: () => undefined }) })(request(await token('disabled-runtime-customer')));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'auth_setup_pending');
});

test('transport assignment preserves unrelated claims and uses only the fixed authenticated value', async () => {
  const events = [];
  let result = { preference: 'sage', unrelated: true };
  await ensureAuthenticatedTransportRole('fixture', { readClaims: async () => result,
    writeClaims: async (uid, value) => { events.push(['write', uid]); result = value; }, audit: async (_uid, phase) => { events.push([phase]); } });
  assert.deepEqual(result, { preference: 'sage', unrelated: true, role: 'authenticated' });
  assert.deepEqual(events, [['requested'], ['write', 'fixture'], ['verified']]);
});

test('a provider claim that does not read back correctly is never reported as verified', async () => {
  const phases = [];
  await assert.rejects(ensureAuthenticatedTransportRole('fixture', {
    readClaims: async () => ({}), writeClaims: async () => {}, audit: async (_uid, phase) => { phases.push(phase); },
  }), error => error.code === 'transport_verification_failed');
  assert.deepEqual(phases, ['requested']);
});

test('conflicting transport roles are never silently downgraded or copied into business roles', async () => {
  for (const role of ['admin', 'staff', 'service_role', 'customer', null]) {
    let writes = 0;
    await assert.rejects(ensureAuthenticatedTransportRole('fixture', { readClaims: async () => ({ role }), writeClaims: async () => { writes++; }, audit: async () => {} }), error => error.code === 'transport_role_conflict');
    assert.equal(writes, 0);
  }
});

test('transport auditing must succeed before a provider write or a successful verification', async () => {
  let writes = 0;
  const base = { readClaims: async () => ({}), writeClaims: async () => { writes++; }, audit: async () => { throw Error('Audit unavailable'); } };
  await assert.rejects(ensureAuthenticatedTransportRole('fixture', base));
  assert.equal(writes, 0);
  await assert.rejects(ensureAuthenticatedTransportRole('fixture', { ...base, readClaims: async () => ({ role: 'authenticated' }) }));
  assert.equal(writes, 0);
});
