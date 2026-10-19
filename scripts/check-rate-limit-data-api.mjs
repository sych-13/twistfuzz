import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Read only the existing public client key, without logging environment content.
const value = readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();
const key = value?.replace(/^"(.*)"$/, '$1');
let isPublic = key?.startsWith('sb_publishable_') ?? false;
if (!isPublic && key?.split('.').length === 3) {
  try { isPublic = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* deny */ }
}
if (!isPublic) throw new Error('An existing public Supabase key is required');
const base = 'https://xoitxpoqejpprjyejgjv.supabase.co/rest/v1';
const report = { checkedAt: new Date().toISOString(), applicationEnabled: false, checks: [] };
for (const check of [
  { name: 'anonymous rate RPC denied', path: '/rpc/consume_request_allowance', method: 'POST',
    body: JSON.stringify({ p_project_id: 'twistfuzz-dev-sych13', p_scope: 'global', p_uid: null }), status: 401, code: '42501' },
  { name: 'private counters not exposed', path: '/request_allowances?select=scope', method: 'GET',
    headers: { 'Accept-Profile': 'app_private' }, status: 406, code: 'PGRST106' },
]) {
  const response = await fetch(base + check.path, { method: check.method, body: check.body,
    headers: { apikey: key, 'Content-Type': 'application/json', ...check.headers }, signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  assert.equal(response.status, check.status);
  assert.equal(body.code, check.code);
  report.checks.push({ name: check.name, status: response.status, code: body.code, result: 'PASS' });
}
writeFileSync('docs/qa/v0.5.0-dev.7-data-api.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
