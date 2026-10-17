import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AccessError, authenticate, verifyFirebaseToken } from '../supabase/functions/_shared/auth.ts';
import { createDependencies, readAllowedOrigins } from '../supabase/functions/_shared/runtime.ts';
import { createRoleHandler } from '../supabase/functions/resolve-role/handler.ts';
import { authenticationConfiguration, isPublicSupabaseKey } from '../src/services/authConfiguration.ts';
import { assertPublicEnvironment } from '../src/services/publicEnvironment.ts';

// Generated in memory for this test process. These keys are never accepted by the runtime adapter.
const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
const jwk = { ...await exportJWK(publicKey), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
const getKey = createLocalJWKSet({ keys: [jwk] });
const seconds = 1792195200;
const now = () => new Date(seconds * 1000);
const projectId = 'twistfuzz-local-tests';
const baseClaims = () => ({ sub: 'fixture-customer', email: 'fixture@example.invalid', email_verified: true,
  iss: `https://securetoken.google.com/${projectId}`, aud: projectId, iat: seconds - 10,
  auth_time: seconds - 60, exp: seconds + 3500, firebase: { sign_in_provider: 'password' } });
async function sign(changes = {}, header = {}) {
  const claims = { ...baseClaims(), ...changes };
  for (const key of Object.keys(claims)) if (claims[key] === undefined) delete claims[key];
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'fixture-key', ...header }).sign(privateKey);
}
function dependencies(overrides = {}) {
  return { projectId, getKey, now,
    getAccount: async uid => ({ uid, email: 'fixture@example.invalid', emailVerified: true, disabled: false, validAfter: 0 }),
    getTrustedRole: async () => 'customer', auditPrivilegedAccess: async () => {}, ...overrides };
}
const accessError = (status, code) => error => error instanceof AccessError && error.status === status && (!code || error.code === code);
function request(token, options = {}) {
  return new Request('https://edge.example.invalid/functions/v1/resolve-role', {
    method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', ...options,
  });
}
const handler = (deps = dependencies()) => createRoleHandler({ allowedOrigins: ['http://127.0.0.1:5173'], dependencies: () => deps });

test('valid RSA signed Firebase-shaped token is verified before trusted account/role lookup', async () => {
  const token = await sign();
  const result = await authenticate(token, dependencies());
  assert.equal(result.identity.uid, 'fixture-customer');
  assert.equal(result.role, 'customer');
});

test('bad signatures and algorithms cannot reach account or role lookups', async () => {
  const other = await generateKeyPair('RS256');
  const forged = await new SignJWT(baseClaims()).setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' }).sign(other.privateKey);
  const hmac = await new SignJWT(baseClaims()).setProtectedHeader({ alg: 'HS256', kid: 'fixture-key' }).sign(new Uint8Array(32).fill(7));
  let reads = 0;
  const deps = dependencies({ getAccount: async () => { reads++; return null; }, getTrustedRole: async () => { reads++; return 'admin'; } });
  for (const token of [forged, hmac, 'a.b.', 'not-a-token', 'a'.repeat(16001)]) {
    await assert.rejects(authenticate(token, deps), accessError(401));
  }
  assert.equal(reads, 0);
});

test('rejects wrong Firebase project, issuer, multiple audiences, invalid user IDs and missing required claims', async () => {
  for (const changes of [{ aud: 'other-project' }, { iss: 'https://securetoken.google.com/other-project' },
    { aud: [projectId, 'another-project'] }, { sub: '' }, { sub: 'x'.repeat(129) },
    ...['sub', 'exp', 'iat', 'auth_time', 'email', 'email_verified', 'firebase'].map(key => ({ [key]: undefined }))]) {
    await assert.rejects(verifyFirebaseToken(await sign(changes), dependencies()), accessError(401));
  }
});

test('rejects expired, future, inconsistent and fractional JWT timestamps', async () => {
  for (const changes of [{ exp: seconds }, { exp: seconds - 1 }, { iat: seconds + 1 },
    { auth_time: seconds + 1 }, { auth_time: seconds - 5 }, { iat: seconds - 1.5 },
    { auth_time: 'yesterday' }, { auth_time: -1 }, { exp: seconds - 20 }]) {
    await assert.rejects(verifyFirebaseToken(await sign(changes), dependencies()), accessError(401));
  }
});

test('rejects missing/unknown key IDs, embedded keys and attacker-directed key URLs', async () => {
  for (const header of [{ kid: '' }, { kid: 'unknown' }, { jku: 'https://attacker.example.invalid/keys' },
    { x5u: 'https://attacker.example.invalid/cert' }, { jwk }, { typ: 'untrusted-token' }]) {
    await assert.rejects(verifyFirebaseToken(await sign({}, header), dependencies()), accessError(401));
  }
});

test('rejects unverified email, anonymous/custom providers, unsupported tenants and unknown factors', async () => {
  for (const changes of [{ email_verified: false }, { email_verified: 'true' }, { email: '' }, { firebase: null },
    { firebase: [] }, { firebase: { sign_in_provider: 'anonymous' } }, { firebase: { sign_in_provider: 'custom' } },
    { firebase: { sign_in_provider: 'password', tenant: 'unconfigured' } },
    { firebase: { sign_in_provider: 'password', sign_in_second_factor: 'made-up' } }]) {
    await assert.rejects(verifyFirebaseToken(await sign(changes), dependencies()), accessError(401));
  }
});

test('trusted lookup governs business role even when signed token metadata claims admin', async () => {
  const token = await sign({ role: 'admin', user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } });
  assert.equal((await authenticate(token, dependencies())).role, 'customer');
  for (const role of [null, undefined, 'owner', 'service_role', {}, ['admin']]) {
    await assert.rejects(authenticate(token, dependencies({ getTrustedRole: async () => role })), accessError(403, 'account_not_provisioned'));
  }
});

test('disabled, deleted, unverified or mismatched accounts and revoked sessions fail closed', async () => {
  const token = await sign();
  const account = await dependencies().getAccount('fixture-customer');
  for (const value of [null, { ...account, disabled: true }, { ...account, uid: 'different' },
    { ...account, emailVerified: false }, { ...account, email: 'changed@example.invalid' }]) {
    await assert.rejects(authenticate(token, dependencies({ getAccount: async () => value })), accessError(401));
  }
  await assert.rejects(authenticate(token, dependencies({ getAccount: async () => ({ ...account, validAfter: seconds - 30 }) })), accessError(401, 'session_revoked'));
  await assert.rejects(authenticate(token, dependencies({ getAccount: async () => ({ ...account, validAfter: NaN }) })), accessError(503));
});

test('database/account lookup failures deny access and do not expose provider errors', async () => {
  const token = await sign();
  const fail = async () => { throw new Error('private provider detail'); };
  for (const deps of [dependencies({ getAccount: fail }), dependencies({ getTrustedRole: fail })]) {
    await assert.rejects(authenticate(token, deps), error => accessError(503)(error) && !error.message.includes('private'));
  }
});

test('customer Google login is allowed; staff/admin Google login is rejected', async () => {
  const token = await sign({ firebase: { sign_in_provider: 'google.com' } });
  assert.equal((await authenticate(token, dependencies())).role, 'customer');
  for (const role of ['staff', 'admin']) {
    await assert.rejects(authenticate(token, dependencies({ getTrustedRole: async () => role })), accessError(403, 'password_required'));
  }
});

test('Admin requires completed MFA and successful audit; staff MFA is optional', async () => {
  const token = await sign();
  await assert.rejects(authenticate(token, dependencies({ getTrustedRole: async () => 'admin' })), accessError(403, 'mfa_required'));
  assert.equal((await authenticate(token, dependencies({ getTrustedRole: async () => 'staff' }))).role, 'staff');
  for (const factor of ['totp', 'phone']) {
    const mfaToken = await sign({ firebase: { sign_in_provider: 'password', sign_in_second_factor: factor } });
    const audits = [];
    const deps = dependencies({ getTrustedRole: async () => 'admin', auditPrivilegedAccess: async (uid, role) => audits.push({ uid, role }) });
    assert.equal((await authenticate(mfaToken, deps)).role, 'admin');
    assert.deepEqual(audits, [{ uid: 'fixture-customer', role: 'admin' }]);
    await assert.rejects(authenticate(mfaToken, { ...deps, auditPrivilegedAccess: async () => { throw new Error('DB down'); } }), accessError(503, 'audit_unavailable'));
  }
});

test('successful role endpoint returns only a role with exact-origin CORS and no cache', async () => {
  const response = await handler()(request(await sign()));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { role: 'customer' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5173');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('HTTP boundary rejects unknown origins, missing tokens, methods and bad JSON before identity lookup', async () => {
  const token = await sign();
  const base = request(token);
  const cases = [
    [request(token, { headers: { ...Object.fromEntries(base.headers), Origin: 'https://attacker.example.invalid' } }), 403],
    [request(token, { headers: { 'Content-Type': 'application/json' } }), 401],
    [new Request(base.url, { method: 'GET' }), 405],
    [request(token, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' } }), 415],
    ...['{', 'null', '[]', '{"role":"admin"}', '{"uid":"different"}', ''].map(body => [request(token, { body }), 400]),
    [request(token, { body: ' '.repeat(513) }), 413],
  ];
  let lookups = 0;
  const handle = handler(dependencies({ getTrustedRole: async () => { lookups++; return 'customer'; } }));
  for (const [input, status] of cases) {
    const response = await handle(input);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(lookups, 0);
});

test('preflight requires allowed origin and does not initialize backend credentials', async () => {
  let calls = 0;
  const handle = createRoleHandler({ allowedOrigins: ['http://127.0.0.1:5173'], dependencies: () => { calls++; throw Error(); } });
  const response = await handle(new Request('https://edge.example.invalid', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173' } }));
  assert.equal(response.status, 204);
  assert.equal(calls, 0);
});

test('HTTP errors redact internal details and disabled server configuration returns 503', async () => {
  const token = await sign();
  const handle = createRoleHandler({ allowedOrigins: [], dependencies: () => { throw new Error('secret credential details'); } });
  const response = await handle(request(token, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret'));
  const environment = { get: () => undefined };
  assert.throws(createDependencies(environment), accessError(503, 'auth_setup_pending'));
  const gated = createRoleHandler({ allowedOrigins: [], dependencies: createDependencies(environment) });
  assert.equal((await gated(request(token, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }))).status, 503);
});

test('server config fails closed and origin configuration excludes wildcards, remote HTTP and paths', () => {
  const environment = values => ({ get: key => values[key] });
  assert.deepEqual(readAllowedOrigins(environment({ TWISTFUZZ_ALLOWED_ORIGINS: '*,http://evil.example,https://valid.example/path,https://valid.example,http://127.0.0.1:5173' })), ['https://valid.example', 'http://127.0.0.1:5173']);
  assert.throws(createDependencies(environment({ TWISTFUZZ_AUTH_ENABLED: 'true' })), accessError(503));
  assert.throws(createDependencies(environment({ TWISTFUZZ_AUTH_ENABLED: 'true', TWISTFUZZ_ALLOWED_ORIGINS: 'http://127.0.0.1:5173' })), accessError(503));
});

test('frontend auth needs all public configuration and an explicit completed-integration gate', () => {
  const config = { VITE_FIREBASE_API_KEY: 'public-fixture', VITE_FIREBASE_AUTH_DOMAIN: 'fixture.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: 'public-app-fixture',
    VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture' };
  assert.equal(authenticationConfiguration({}).ready, false);
  assert.equal(authenticationConfiguration(config).ready, false);
  assert.equal(authenticationConfiguration({ ...config, VITE_AUTH_INTEGRATION_READY: 'true' }).ready, true);
  for (const key of Object.keys(config)) {
    assert.equal(authenticationConfiguration({ ...config, [key]: '', VITE_AUTH_INTEGRATION_READY: 'true' }).ready, false);
  }
  assert.equal(authenticationConfiguration({ ...config, VITE_SUPABASE_URL: 'http://remote.example.invalid', VITE_AUTH_INTEGRATION_READY: 'true' }).ready, false);
});

test('public key detection permits only publishable and legacy anon Supabase credentials', () => {
  const jwt = role => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture`;
  assert.equal(isPublicSupabaseKey('sb_publishable_fixture'), true);
  assert.equal(isPublicSupabaseKey(jwt('anon')), true);
  for (const value of ['', null, 'arbitrary-string', 'sb_secret_fixture', jwt('service_role'), jwt('authenticated')]) {
    assert.equal(isPublicSupabaseKey(value), false);
  }
});

test('build guard refuses private credentials before bundling, without echoing credential values', () => {
  for (const environment of [
    { VITE_SUPABASE_ANON_KEY: 'sb_secret_fixture-never-use' },
    { VITE_SERVICE_ROLE_KEY: 'fixture-never-use' },
    { VITE_FIREBASE_SERVICE_ACCOUNT_JSON: 'fixture-never-use' },
    { VITE_UNRELATED: '-----BEGIN PRIVATE KEY-----fixture-never-use' },
  ]) {
    assert.throws(() => assertPublicEnvironment(environment), error => !error.message.includes('fixture-never-use'));
  }
  assert.doesNotThrow(() => assertPublicEnvironment({ VITE_SUPABASE_ANON_KEY: '', VITE_FIREBASE_API_KEY: 'public-fixture' }));
  assert.doesNotThrow(() => assertPublicEnvironment({ VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture' }));
});
