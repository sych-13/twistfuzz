import assert from 'node:assert/strict';
import test from 'node:test';
import { createJsonEndpoint } from '../supabase/functions/_shared/http.ts';

const origin = 'https://preview.example.invalid';
function boundary(options = {}) {
  const calls = { dependencies: 0, handle: 0 };
  const handle = createJsonEndpoint({ allowedOrigins: [origin],
    dependencies: () => { calls.dependencies++; return {}; },
    handle: async body => { calls.handle++; return body; }, ...options });
  return { handle, calls };
}
function request(body = '{}', options = {}) {
  const { headers, ...rest } = options;
  return new Request(origin, { method: 'POST', body, duplex: 'half', ...rest,
    headers: { Origin: origin, Authorization: 'Bearer a.b.c', 'Content-Type': 'application/json', ...headers } });
}
async function denied(subject, input, status, code) {
  const response = await subject.handle(input);
  assert.equal(response.status, status);
  assert.equal((await response.json()).error, code);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(subject.calls, { dependencies: 0, handle: 0 });
}

test('stalled body expires and cancels even when stream cancellation never settles', { timeout: 1000 }, async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } });
  await denied(boundary({ bodyReadTimeoutMs: 20 }), request(body), 408, 'request_timeout');
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test('deadline covers the whole body despite periodic small chunks', { timeout: 1000 }, async () => {
  let interval;
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { interval = setInterval(() => controller.enqueue(new TextEncoder().encode(' ')), 5); },
    cancel() { clearInterval(interval); cancelled = true; } });
  try {
    await denied(boundary({ bodyReadTimeoutMs: 40 }), request(body), 408, 'request_timeout');
    assert.equal(cancelled, true);
  } finally { clearInterval(interval); }
});

test('request cancellation interrupts a pending body read', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const subject = boundary();
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const pending = denied(subject, request(body, { signal: controller.signal }), 408, 'request_timeout');
  controller.abort();
  await pending;
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test('already cancelled requests never initialize dependencies', async () => {
  const controller = new AbortController(); controller.abort();
  await denied(boundary(), request('{}', { signal: controller.signal }), 408, 'request_timeout');
});

test('declared oversized body is cancelled before reading or initializing dependencies', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await denied(boundary(), request(body, { headers: { 'Content-Length': '513' } }), 413, 'body_too_large');
  assert.equal(cancelled, true);
});

test('actual byte count rejects oversize despite a dishonest short Content-Length', async () => {
  await denied(boundary(), request(' '.repeat(513), { headers: { 'Content-Length': '2' } }), 413, 'body_too_large');
});

test('byte limits count UTF-8 bytes across multiple chunks', async () => {
  const chunks = ['{"name":"', 'é'.repeat(260), '"}'];
  const body = new ReadableStream({ start(controller) { for (const value of chunks) controller.enqueue(new TextEncoder().encode(value)); controller.close(); } });
  await denied(boundary(), request(body), 413, 'body_too_large');
});

test('malformed, negative, duplicate and inaccurate content lengths fail before dependencies', async () => {
  for (const value of ['-1', 'x', '2, 2', '9007199254740992', '3', '0']) {
    await denied(boundary(), request('{}', { headers: { 'Content-Length': value } }), 400, 'invalid_request');
  }
});

test('malformed JSON and invalid UTF-8 fail before dependencies', async () => {
  for (const value of ['{', '', new Uint8Array([0xc3, 0x28])]) {
    await denied(boundary(), request(value), 400, 'invalid_request');
  }
});

test('stream errors are redacted as invalid input', async () => {
  const body = new ReadableStream({ start(controller) { controller.error(new Error('private provider details')); } });
  await denied(boundary(), request(body), 400, 'invalid_request');
});

test('unsupported content type never initializes server dependencies', async () => {
  await denied(boundary(), request('{}', { headers: { 'Content-Type': 'text/plain' } }), 415, 'json_required');
});

test('exact limit and split UTF-8 remain valid; JSON is handled once', async () => {
  const text = '{"name":"é"}';
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const subject = boundary({ maxBodyBytes: bytes.length });
  const response = await subject.handle(request(body, { headers: { 'Content-Length': String(bytes.length) } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'é' });
  assert.deepEqual(subject.calls, { dependencies: 1, handle: 1 });
  assert.equal(body.locked, false);
});

test('invalid server limits cannot disable the deadline or size bound', () => {
  for (const options of [{ bodyReadTimeoutMs: 0 }, { bodyReadTimeoutMs: Infinity }, { bodyReadTimeoutMs: 5001 }, { maxBodyBytes: 0 }, { maxBodyBytes: NaN }]) {
    assert.throws(() => boundary(options), /Invalid server request limits/);
  }
});
