import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// Explicit, read-only checks for the approved development project. No credentials
// or test-key acceptance paths are introduced into application runtime code.
const base = 'https://xoitxpoqejpprjyejgjv.supabase.co/functions/v1';
const origin = 'https://twistfuzz-bloom-preview.vercel.app';
const report = { startedAt: new Date().toISOString(), projectId: 'xoitxpoqejpprjyejgjv', applicationEnabled: false, checks: [] };
const cases = [
  { name: 'missing identity denied', status: 401, error: 'invalid_identity' },
  { name: 'malformed identity denied', authorization: 'Bearer invalid', status: 401, error: 'invalid_identity' },
  { name: 'untrusted origin denied', origin: 'https://untrusted.example.invalid', status: 403, error: 'origin_not_allowed' },
  { name: 'lookalike origin denied', origin: `${origin}.example.invalid`, status: 403, error: 'origin_not_allowed' },
  { name: 'opaque origin denied', origin: 'null', status: 403, error: 'origin_not_allowed' },
  { name: 'GET denied', method: 'GET', status: 405, error: 'method_not_allowed' },
  { name: 'allowed preflight', method: 'OPTIONS', status: 204 },
  { name: 'syntactic token cannot pass disabled gate', authorization: 'Bearer a.b.c', status: 503, error: 'auth_setup_pending' },
  { name: 'originless request cannot pass disabled gate', origin: null, authorization: 'Bearer a.b.c', status: 503, error: 'auth_setup_pending' },
  { name: 'unsupported body type rejected before runtime', authorization: 'Bearer a.b.c', contentType: 'text/plain', status: 415, error: 'json_required' },
  { name: 'malformed JSON rejected before runtime', authorization: 'Bearer a.b.c', body: '{', status: 400, error: 'invalid_request' },
  { name: 'oversized body rejected before runtime', authorization: 'Bearer a.b.c', oversized: true, status: 413, error: 'body_too_large' },
];
for (const endpoint of ['resolve-role', 'provision-customer', 'saved-designs']) {
  for (const check of cases) {
    const result = { endpoint, name: check.name, expectedStatus: check.status };
    try {
      const method = check.method ?? 'POST';
      const requestOrigin = check.origin === undefined ? origin : check.origin;
      const headers = { 'Content-Type': check.contentType ?? 'application/json' };
      if (requestOrigin !== null) headers.Origin = requestOrigin;
      if (check.authorization) headers.Authorization = check.authorization;
      const response = await fetch(`${base}/${endpoint}`, { method, headers, signal: AbortSignal.timeout(30000),
        ...(method === 'POST' ? { body: check.oversized ? ' '.repeat(endpoint === 'saved-designs' ? 16001 : 513)
          : check.body ?? (endpoint === 'saved-designs' ? '{"action":"list"}' : '{}') } : {}) });
      result.status = response.status;
      const body = await response.text();
      assert.equal(response.status, check.status);
      if (check.error) assert.equal(JSON.parse(body).error, check.error);
      else assert.equal(body, '');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('access-control-allow-origin'), requestOrigin === origin ? origin : null);
      if (method === 'OPTIONS') {
        assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
        assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
      }
      result.result = 'PASS';
    } catch (error) {
      result.result = 'FAIL';
      // These requests never contain a real credential. Still keep raw response
      // bodies and request headers out of retained evidence.
      result.reason = error instanceof Error ? error.message : 'Request failed';
      process.exitCode = 1;
    }
    report.checks.push(result);
    console.log(`${result.result} ${endpoint}: ${check.name} (${result.status ?? 'no response'})`);
  }
}
report.finishedAt = new Date().toISOString();
writeFileSync('docs/qa/backend-deployment-http.json', `${JSON.stringify(report, null, 2)}\n`);
