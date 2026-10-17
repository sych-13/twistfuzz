import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finishCustomerSetup } from '../src/features/auth/customerSetup.ts';

test('Customer setup requests fresh SDK claims only after server confirmation', async () => {
  let refreshed = 0;
  await finishCustomerSetup({ role: 'customer', refreshToken: true }, async () => { refreshed++; return { role: 'authenticated' }; });
  assert.equal(refreshed, 1);
});

test('invalid or privileged setup responses cannot advance token readiness', async () => {
  let refreshed = 0;
  for (const response of [null, [], {}, { role: 'admin', refreshToken: true }, { role: 'customer', refreshToken: false }]) {
    await assert.rejects(finishCustomerSetup(response, async () => { refreshed++; return { role: 'authenticated' }; }));
  }
  assert.equal(refreshed, 0);
});

test('stale, missing or non-authenticated transport claims leave Customer setup unavailable', async () => {
  for (const role of [undefined, 'customer', 'admin', 'service_role']) {
    await assert.rejects(finishCustomerSetup({ role: 'customer', refreshToken: true }, async () => ({ role })), /still pending/);
  }
});
