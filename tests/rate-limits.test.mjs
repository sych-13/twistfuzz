import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { localDatabase, asRole, fixtureProject } from './helpers/database.mjs';
import { createRateLimitConsumer } from '../supabase/functions/_shared/rateLimit.ts';

let database;
before(async () => { ({ database } = await localDatabase()); });
after(async () => { await database?.close(); });
beforeEach(async () => {
  await database.exec('truncate app_private.request_allowances');
  await database.query('update app_private.auth_configuration set firebase_project_id=$1, integration_enabled=true', [fixtureProject]);
});
const consume = (scope, uid = null) => asRole(database, 'service_role', {}, async db =>
  (await db.query('select * from public.consume_request_allowance($1,$2,$3)', [fixtureProject, scope, uid])).rows[0]);
const sqlError = code => error => error.code === code;

test('anonymous and authenticated users cannot call the limiter or manipulate its counters', async () => {
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asRole(database, role, {}, db => db.query('select * from public.consume_request_allowance($1,$2,$3)', [fixtureProject, 'identity', 'uid'])), sqlError('42501'));
    await assert.rejects(asRole(database, role, {}, db => db.query('select * from app_private.request_allowances')), sqlError('42501'));
    await assert.rejects(asRole(database, role, {}, db => db.query('delete from app_private.request_allowances')), sqlError('42501'));
  }
  const definition = (await database.query("select prosecdef from pg_proc where oid='public.consume_request_allowance(text,text,text)'::regprocedure")).rows[0];
  assert.equal(definition.prosecdef, false);
});

test('missing/wrong project or disabled integration fails without creating a counter', async () => {
  await assert.rejects(asRole(database, 'service_role', {}, db => db.query("select * from public.consume_request_allowance('wrong-project','global',null)")), sqlError('42501'));
  await database.exec('update app_private.auth_configuration set integration_enabled=false');
  await assert.rejects(consume('global'), sqlError('42501'));
  await database.exec('update app_private.auth_configuration set firebase_project_id=null, integration_enabled=true');
  await assert.rejects(consume('global'), sqlError('42501'));
  assert.equal((await database.query('select count(*)::int as count from app_private.request_allowances')).rows[0].count, 0);
});

test('invalid scope, caller-selected UID for global scope and unbounded identity are rejected', async () => {
  for (const [scope, uid] of [[null, null], ['custom', 'uid'], ['global', 'uid'], ['identity', null], ['identity', ''], ['identity', 'x'.repeat(129)]]) {
    await assert.rejects(consume(scope, uid), sqlError('22023'));
  }
});

test('identity capacity is 60 and denied requests do not extend or increment the window', async () => {
  for (let i = 0; i < 60; i++) assert.deepEqual(await consume('identity', 'customer-a'), { allowed: true, retry_after_seconds: 0 });
  const before = (await database.query('select used,window_expires_at from app_private.request_allowances')).rows[0];
  for (let i = 0; i < 3; i++) {
    const denied = await consume('identity', 'customer-a');
    assert.equal(denied.allowed, false);
    assert.ok(denied.retry_after_seconds >= 1 && denied.retry_after_seconds <= 60);
  }
  assert.deepEqual((await database.query('select used,window_expires_at from app_private.request_allowances')).rows[0], before);
});

test('global capacity is fixed at 600 shared calls per database window', async () => {
  const rows = await asRole(database, 'service_role', {}, async db => (await db.query(`
    select r.* from generate_series(1,601) g(i) cross join lateral
    public.consume_request_allowance($1, case when i > 0 then 'global' else 'identity' end, null) r`, [fixtureProject])).rows);
  assert.equal(rows.filter(row => row.allowed).length, 600);
  assert.equal(rows[600].allowed, false);
  assert.equal((await database.query("select used from app_private.request_allowances where scope='global'")).rows[0].used, 600);
});

test('verified identities have independent counters and raw UIDs are not stored', async () => {
  await consume('identity', 'customer-a'); await consume('identity', 'customer-a');
  await consume('identity', 'customer-b'); await consume('global');
  const rows = (await database.query('select scope,subject_key,used from app_private.request_allowances order by used')).rows;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.filter(r => r.scope === 'identity').map(r => r.used), [1, 2]);
  for (const row of rows.filter(r => r.scope === 'identity')) assert.match(row.subject_key, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(rows).includes('customer-'), false);
});

test('expired capacity resets using database time without a client clock argument', async () => {
  await consume('identity', 'customer-a');
  await database.exec("update app_private.request_allowances set used=60,window_expires_at=clock_timestamp()-interval '1 second'");
  assert.deepEqual(await consume('identity', 'customer-a'), { allowed: true, retry_after_seconds: 0 });
  const row = (await database.query('select used,window_expires_at > clock_timestamp() as renewed from app_private.request_allowances')).rows[0];
  assert.deepEqual(row, { used: 1, renewed: true });
});

test('cleanup is bounded to 100 old rows and preserves current windows', async () => {
  await database.exec(`insert into app_private.request_allowances(scope,subject_key,used,window_expires_at)
    select 'identity',encode(sha256(convert_to(i::text,'UTF8')),'hex'),1,clock_timestamp()-interval '2 days' from generate_series(1,201) i`);
  await consume('global');
  assert.equal((await database.query("select count(*)::int as count from app_private.request_allowances where window_expires_at < clock_timestamp()")).rows[0].count, 101);
  await consume('identity', 'new-customer');
  assert.equal((await database.query("select count(*)::int as count from app_private.request_allowances where window_expires_at < clock_timestamp()")).rows[0].count, 1);
  assert.equal((await database.query("select used from app_private.request_allowances where scope='global'")).rows[0].used, 1);
});

test('actual Supabase adapter sends only trusted scope/project/UID and an abort signal', async () => {
  const requests = [];
  const database = createClient('https://api.example.invalid', 'test-only-server-key', { auth: { persistSession: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(options.body), signal: options.signal });
      return new Response(JSON.stringify({ allowed: true, retry_after_seconds: 0 }), { headers: { 'Content-Type': 'application/json' } });
    } } });
  const limiter = createRateLimitConsumer(database, fixtureProject);
  await limiter('global'); await limiter('identity', 'verified-uid');
  assert.deepEqual(requests.map(r => r.body), [
    { p_project_id: fixtureProject, p_scope: 'global', p_uid: null },
    { p_project_id: fixtureProject, p_scope: 'identity', p_uid: 'verified-uid' },
  ]);
  for (const request of requests) { assert.match(request.url, /\/rest\/v1\/rpc\/consume_request_allowance$/); assert.ok(request.signal instanceof AbortSignal); }
});

test('RPC rejection is redacted with no permissive or in-memory fallback', async () => {
  let calls = 0;
  const database = createClient('https://api.example.invalid', 'test-only-server-key', { auth: { persistSession: false },
    global: { fetch: async () => { calls++; return new Response(JSON.stringify({ message: 'private database details' }), { status: 403, headers: { 'Content-Type': 'application/json' } }); } } });
  await assert.rejects(createRateLimitConsumer(database, fixtureProject)('global'), /^Error: Request allowance unavailable$/);
  assert.equal(calls, 1);
});
