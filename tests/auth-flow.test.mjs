import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticationMessage, AuthFlowError, operationGuard, verificationCode, verifyPortalAccount } from '../src/features/auth/authFlow.ts';

test('verification codes preserve leading zeroes and reject malformed values', () => {
  assert.equal(verificationCode('012345'), '012345');
  for (const value of ['', '12345', '1234567', '123 45', 'abcdef', '１２３４５６']) assert.throws(() => verificationCode(value), /six-digit/);
});

test('a portal requires refreshed verified identity and the matching server role', async () => {
  for (const role of ['customer', 'staff', 'admin']) for (const portal of ['customer', 'staff', 'admin']) {
    const events = [];
    const services = { refresh: async () => { events.push('refresh'); }, resolveRole: async () => { events.push('server-role'); return role; }, signOutCurrent: async uid => { events.push(`sign-out:${uid}`); } };
    const result = verifyPortalAccount({ uid: 'fixture', emailVerified: true }, portal, services);
    if (role === portal) { await result; assert.deepEqual(events, ['refresh', 'server-role']); }
    else { await assert.rejects(result, error => error.code === 'wrong-portal'); assert.deepEqual(events, ['refresh', 'server-role', 'sign-out:fixture']); }
  }
});

test('unverified accounts are signed out without looking up a role', async () => {
  const events = [];
  await assert.rejects(verifyPortalAccount({ uid: 'unverified', emailVerified: false }, 'customer', {
    refresh: async () => {}, resolveRole: async () => { events.push('role'); return 'customer'; }, signOutCurrent: async uid => { events.push(uid); },
  }), error => error.code === 'email-unverified');
  assert.deepEqual(events, ['unverified']);
});

test('identity refresh can update email verification before authorization', async () => {
  const user = { uid: 'fixture', emailVerified: false };
  await verifyPortalAccount(user, 'customer', { refresh: async account => { account.emailVerified = true; }, resolveRole: async () => 'customer', signOutCurrent: async () => { throw Error('Should not sign out'); } });
});

test('role-service errors are redacted and failed verification signs out', async () => {
  let signedOut = false;
  await assert.rejects(verifyPortalAccount({ uid: 'fixture', emailVerified: true }, 'admin', {
    refresh: async () => {}, resolveRole: async () => { throw Error('private backend detail'); }, signOutCurrent: async () => { signedOut = true; },
  }), error => error.code === 'role-unavailable' && !error.message.includes('private'));
  assert.equal(signedOut, true);
});

test('refresh errors still sign out and a sign-out failure never grants portal access', async () => {
  let attempts = 0;
  await assert.rejects(verifyPortalAccount({ uid: 'fixture', emailVerified: true }, 'admin', {
    refresh: async () => { throw Error('refresh failed'); }, resolveRole: async () => 'admin',
    signOutCurrent: async () => { attempts++; throw Error('logout failed'); },
  }), /refresh failed/);
  assert.equal(attempts, 1);
});

test('cancel or a newer operation invalidates late async results', () => {
  const guard = operationGuard();
  const first = guard.begin();
  assert.equal(first(), true);
  const next = guard.begin();
  assert.equal(first(), false);
  assert.equal(next(), true);
  guard.invalidate();
  assert.equal(next(), false);
  assert.equal(guard.begin()(), true);
});

test('public auth errors do not echo SDK details and expired sessions require a fresh sign-in', () => {
  for (const error of [Error('private-token-fixture'), { code: 'unrecognized', message: 'private-token-fixture' }, null]) {
    assert.equal(authenticationMessage(error).includes('private-token-fixture'), false);
  }
  for (const code of ['auth/invalid-multi-factor-session', 'auth/code-expired', 'auth/session-expired']) assert.match(authenticationMessage({ code }), /Cancel and sign in again/);
  assert.equal(authenticationMessage({ code: 'auth/user-not-found' }), authenticationMessage({ code: 'auth/wrong-password' }));
  assert.match(authenticationMessage(new AuthFlowError('safe', 'Choose a supported verification method.')), /supported verification/);
});

test('verified Customer onboarding runs before role resolution and never runs for privileged portals', async () => {
  for (const portal of ['customer', 'staff', 'admin']) {
    const events = [];
    await verifyPortalAccount({ uid: 'fixture', emailVerified: true }, portal, {
      refresh: async () => { events.push('refresh'); }, ensureCustomer: async () => { events.push('ensure-customer'); },
      resolveRole: async () => { events.push('server-role'); return portal; }, signOutCurrent: async () => {},
    });
    assert.deepEqual(events, portal === 'customer' ? ['refresh', 'ensure-customer', 'server-role'] : ['refresh', 'server-role']);
  }
});

test('failed Customer onboarding signs out without requesting role access', async () => {
  const events = [];
  await assert.rejects(verifyPortalAccount({ uid: 'fixture', emailVerified: true }, 'customer', {
    refresh: async () => {}, ensureCustomer: async () => { throw Error('private setup detail'); },
    resolveRole: async () => { events.push('role'); return 'customer'; }, signOutCurrent: async () => { events.push('sign-out'); },
  }), error => error.code === 'customer-setup-unavailable' && !error.message.includes('private'));
  assert.deepEqual(events, ['sign-out']);
});

test('cancelled verification does not start a later provisioning or role request', async () => {
  let active = true;
  const events = [];
  await assert.rejects(verifyPortalAccount({ uid: 'fixture', emailVerified: true }, 'customer', {
    refresh: async () => { active = false; }, isActive: () => active,
    ensureCustomer: async () => { events.push('provision'); }, resolveRole: async () => { events.push('role'); return 'customer'; },
    signOutCurrent: async () => { events.push('sign-out'); },
  }), error => error.code === 'cancelled');
  assert.deepEqual(events, ['sign-out']);
});
