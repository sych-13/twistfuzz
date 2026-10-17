import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import MfaChallenge from '../src/features/auth/MfaChallenge';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true });
Object.defineProperty(globalThis, 'MutationObserver', { value: dom.window.MutationObserver, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
afterEach(cleanup);
const totp = { uid: 'authenticator-fixture', kind: 'totp' as const, label: 'Authenticator app' };
const phone = { uid: 'phone-fixture', kind: 'phone' as const, label: 'Text message ending 1234' };
const props = () => ({ portal: 'admin' as const, factors: [totp, phone], busy: false, error: '', onVerify: async (_uid: string, _code: string) => {}, onSendSms: async (_uid: string, _container: HTMLElement) => true, onCancel: () => {} });

test('authenticator method is preferred and a six-digit code is submitted without losing leading zeroes', async () => {
  const submissions: string[][] = [];
  const ui = render(<MfaChallenge {...props()} factors={[phone, totp]} onVerify={async (uid, code) => { submissions.push([uid, code]); }} />);
  assert.equal((ui.getByLabelText('Verification method') as HTMLSelectElement).value, totp.uid);
  fireEvent.change(ui.getByLabelText('Verification code'), { target: { value: '012345' } });
  fireEvent.click(ui.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() => assert.deepEqual(submissions, [[totp.uid, '012345']]));
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).value, '');
});

test('short codes never reach the verification callback', async () => {
  let calls = 0;
  const ui = render(<MfaChallenge {...props()} onVerify={async () => { calls++; }} />);
  fireEvent.change(ui.getByLabelText('Verification code'), { target: { value: '12345' } });
  fireEvent.click(ui.getByRole('button', { name: 'Verify and continue' }));
  assert.match(ui.getByRole('alert').textContent ?? '', /six-digit/);
  assert.equal(calls, 0);
});

test('an enrolled phone requires sending a code before verification becomes available', async () => {
  const submitted: string[] = [];
  const ui = render(<MfaChallenge {...props()} factors={[phone]} onVerify={async (_uid, code) => { submitted.push(code); }} />);
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).disabled, true);
  fireEvent.click(ui.getByRole('button', { name: 'Send verification code' }));
  await waitFor(() => assert.match(ui.getByRole('status').textContent ?? '', /code sent/));
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).disabled, false);
  fireEvent.change(ui.getByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.click(ui.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() => assert.deepEqual(submitted, ['123456']));
});

test('switching factors clears entered codes and requires a new SMS request', async () => {
  const ui = render(<MfaChallenge {...props()} />);
  const method = ui.getByLabelText('Verification method');
  fireEvent.change(ui.getByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.change(method, { target: { value: phone.uid } });
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).value, '');
  fireEvent.click(ui.getByRole('button', { name: 'Send verification code' }));
  await waitFor(() => assert.ok(ui.queryByRole('status')));
  fireEvent.change(method, { target: { value: totp.uid } });
  fireEvent.change(method, { target: { value: phone.uid } });
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).disabled, true);
  assert.equal(ui.queryByRole('status'), null);
});

test('cancel remains available during verification and clears the entered code', () => {
  let cancelled = false;
  const options = props();
  const ui = render(<MfaChallenge {...options} onCancel={() => { cancelled = true; }} />);
  fireEvent.change(ui.getByLabelText('Verification code'), { target: { value: '123456' } });
  ui.rerender(<MfaChallenge {...options} busy onCancel={() => { cancelled = true; }} />);
  assert.equal((ui.getByRole('button', { name: 'Verifying…' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(ui.getByRole('button', { name: 'Cancel sign-in' }));
  assert.equal(cancelled, true);
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).value, '');
});

test('a late SMS response cannot update an unmounted challenge', async () => {
  let resolve!: (result: boolean) => void;
  const waiting = new Promise<boolean>(done => { resolve = done; });
  const ui = render(<MfaChallenge {...props()} factors={[phone]} onSendSms={() => waiting} />);
  fireEvent.click(ui.getByRole('button', { name: 'Send verification code' }));
  ui.unmount();
  await act(async () => { resolve(true); await waiting; });
  assert.equal(dom.window.document.querySelector('[role="status"]'), null);
});

test('failed SMS delivery does not enable code entry or announce success', async () => {
  const ui = render(<MfaChallenge {...props()} factors={[phone]} onSendSms={async () => false} />);
  fireEvent.click(ui.getByRole('button', { name: 'Send verification code' }));
  await act(async () => {});
  assert.equal((ui.getByLabelText('Verification code') as HTMLInputElement).disabled, true);
  assert.equal(ui.queryByRole('status'), null);
});

test('accessible errors identify the code field and no Admin recovery bypass is rendered', () => {
  const ui = render(<MfaChallenge {...props()} error="That verification code was not accepted." />);
  const input = ui.getByLabelText('Verification code');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(input.getAttribute('aria-describedby'), ui.getByRole('alert').id);
  assert.ok(ui.getByText(/Password reset alone does not restore Admin access/));
  assert.equal(ui.queryByRole('button', { name: /skip|reset password|disable MFA/i }), null);
});

test('a missing supported factor cannot submit or hide cancellation', () => {
  const ui = render(<MfaChallenge {...props()} factors={[]} />);
  assert.equal((ui.getByRole('button', { name: 'Verify and continue' }) as HTMLButtonElement).disabled, true);
  assert.ok(ui.getByRole('button', { name: 'Cancel sign-in' }));
});
