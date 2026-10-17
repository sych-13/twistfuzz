import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { asRole, fixtureClaims, fixtureProject, localDatabase } from './helpers/database.mjs';
import { defaultDesign, flowerKinds, flowerPalette, wrappers, ribbons } from '../src/features/studio/design.ts';

const alice = 'customer.alpha-non-uuid';
const bob = 'customer.beta-non-uuid';
const aliceDesign = '11111111-1111-4111-8111-111111111111';
const bobDesign = '22222222-2222-4222-8222-222222222222';
let database;
let initialConfiguration;
const denied = error => error?.code === '42501';
const invalid = error => error?.code === '23514';
const asCustomer = (uid, action, overrides = {}) => asRole(database, 'authenticated', fixtureClaims(uid, overrides), action);

before(async () => {
  const local = await localDatabase();
  database = local.database;
  console.log(`Local RLS engine: ${local.version}`);
  initialConfiguration = (await database.query('select * from app_private.auth_configuration')).rows[0];
  await database.query('update app_private.auth_configuration set firebase_project_id=$1, integration_enabled=true', [fixtureProject]);
  for (const [uid, role, active] of [[alice, 'customer', true], [bob, 'customer', true], ['disabled-customer', 'customer', false], ['staff-operations', 'staff', true], ['owner-admin', 'admin', true]]) {
    await database.query('insert into public.profiles(firebase_uid,email,role,is_active) values($1,$2,$3,$4)', [uid, `${uid}@example.invalid`, role, active]);
  }
  for (const [id, uid] of [[aliceDesign, alice], [bobDesign, bob]]) {
    await database.query('insert into public.custom_designs(id,owner_uid,configuration) values($1,$2,$3)', [id, uid, JSON.stringify(defaultDesign())]);
  }
});
after(async () => { await database?.close(); });

test('the schema candidate starts disabled and missing project configuration denies access', async () => {
  assert.equal(initialConfiguration.integration_enabled, false);
  assert.equal(initialConfiguration.firebase_project_id, null);
  await database.query('update app_private.auth_configuration set integration_enabled=false');
  try {
    const result = await asCustomer(alice, db => db.query('select id from public.custom_designs'));
    assert.equal(result.rows.length, 0);
    await assert.rejects(asCustomer(alice, db => db.query('insert into public.custom_designs(owner_uid,configuration) values($1,$2)', [alice, JSON.stringify(defaultDesign())])), denied);
  } finally { await database.query('update app_private.auth_configuration set integration_enabled=true'); }
});

test('text Firebase UIDs see only their own active profile and saved designs', async () => {
  const result = await asCustomer(alice, async db => ({
    profiles: (await db.query('select firebase_uid,role from public.profiles')).rows,
    designs: (await db.query('select id,owner_uid from public.custom_designs')).rows,
  }));
  assert.deepEqual(result.profiles, [{ firebase_uid: alice, role: 'customer' }]);
  assert.deepEqual(result.designs, [{ id: aliceDesign, owner_uid: alice }]);
});

test('anonymous SQL role has no application table access even with customer-shaped claims', async () => {
  for (const table of ['profiles', 'custom_designs', 'products', 'flower_types', 'audit_events']) {
    await assert.rejects(asRole(database, 'anon', fixtureClaims(alice), db => db.query(`select * from public.${table}`)), denied);
  }
});

test('missing, disabled and non-customer profiles cannot access Customer designs', async () => {
  for (const uid of ['unprovisioned-customer', 'disabled-customer', 'staff-operations', 'owner-admin']) {
    const result = await asCustomer(uid, db => db.query('select id from public.custom_designs'));
    assert.equal(result.rows.length, 0);
    await assert.rejects(asCustomer(uid, db => db.query('insert into public.custom_designs(owner_uid,configuration) values($1,$2)', [uid, JSON.stringify(defaultDesign())])), denied);
  }
});

test('wrong-project, unverified, expired, malformed and unsupported claims fail closed', async () => {
  const seconds = Math.floor(Date.now() / 1000);
  for (const changes of [{ aud: 'wrong-project' }, { aud: [fixtureProject] }, { iss: 'https://securetoken.google.com/wrong-project' },
    { sub: null }, { sub: '' }, { sub: 'x'.repeat(129) }, { role: null }, { role: 'admin' },
    { email_verified: false }, { email_verified: 'true' }, { firebase: null }, { firebase: [] },
    { firebase: { sign_in_provider: 'anonymous' } }, { firebase: { sign_in_provider: 'password', tenant: 'other' } },
    { exp: seconds - 1 }, { exp: 'tomorrow' }, { iat: seconds + 3600 }, { auth_time: seconds + 3600 }, { iat: seconds - 1.5 }]) {
    const result = await asCustomer(alice, db => db.query('select id from public.custom_designs'), changes);
    assert.equal(result.rows.length, 0, JSON.stringify(changes));
  }
  const missing = await asRole(database, 'authenticated', {}, db => db.query('select id from public.custom_designs'));
  assert.equal(missing.rows.length, 0);
});

test('supported Google Customer claims retain the same ownership restrictions', async () => {
  const result = await asCustomer(alice, db => db.query('select id from public.custom_designs'), { firebase: { sign_in_provider: 'google.com' } });
  assert.deepEqual(result.rows.map(row => row.id), [aliceDesign]);
});

test('customer design create/read/update/delete works and metadata stays server-generated', async () => {
  await asCustomer(alice, async db => {
    const created = (await db.query('insert into public.custom_designs(owner_uid,name,configuration) values($1,$2,$3) returning *', [alice, 'My garden bouquet', JSON.stringify(defaultDesign())])).rows[0];
    assert.equal(created.revision, 1);
    assert.ok(created.id);
    const updated = (await db.query('update public.custom_designs set name=$1 where id=$2 returning *', ['My rose garden', created.id])).rows[0];
    assert.equal(updated.revision, 2);
    assert.equal(updated.owner_uid, alice);
    assert.equal(updated.name, 'My rose garden');
    assert.ok(new Date(updated.updated_at).getTime() >= new Date(created.updated_at).getTime());
    const removed = await db.query('delete from public.custom_designs where id=$1 returning id', [created.id]);
    assert.deepEqual(removed.rows, [{ id: created.id }]);
  });
});

test('cross-user read/update/delete affects no rows and cross-user create is rejected', async () => {
  await asCustomer(alice, async db => {
    assert.equal((await db.query('select id from public.custom_designs where id=$1', [bobDesign])).rows.length, 0);
    assert.equal((await db.query('update public.custom_designs set name=$1 where id=$2 returning id', ['Unauthorized', bobDesign])).rows.length, 0);
    assert.equal((await db.query('delete from public.custom_designs where id=$1 returning id', [bobDesign])).rows.length, 0);
  });
  await assert.rejects(asCustomer(alice, db => db.query('insert into public.custom_designs(owner_uid,configuration) values($1,$2)', [bob, JSON.stringify(defaultDesign())])), denied);
});

test('revision checks detect a stale editor rather than silently replacing a newer save', async () => {
  await asCustomer(alice, async db => {
    const revision = (await db.query('select revision from public.custom_designs where id=$1', [aliceDesign])).rows[0].revision;
    const first = await db.query('update public.custom_designs set name=$1 where id=$2 and revision=$3 returning revision', ['First editor save', aliceDesign, revision]);
    assert.deepEqual(first.rows, [{ revision: revision + 1 }]);
    const stale = await db.query('update public.custom_designs set name=$1 where id=$2 and revision=$3 returning revision', ['Stale editor save', aliceDesign, revision]);
    assert.equal(stale.rows.length, 0);
    assert.equal((await db.query('select name from public.custom_designs where id=$1', [aliceDesign])).rows[0].name, 'First editor save');
  });
});

test('clients cannot reassign design identity or forge revisions and timestamps', async () => {
  for (const [column, value] of [['owner_uid', bob], ['revision', 999], ['created_at', '2000-01-01'], ['id', bobDesign]]) {
    await assert.rejects(asCustomer(alice, db => db.query(`update public.custom_designs set ${column}=$1 where id=$2`, [value, aliceDesign])), denied);
  }
  await assert.rejects(asCustomer(alice, db => db.query('insert into public.custom_designs(owner_uid,configuration,revision) values($1,$2,100)', [alice, JSON.stringify(defaultDesign())])), denied);
});

test('profiles, role assignment, integration settings and audit data remain server-only writes', async () => {
  for (const sql of [
    "update public.profiles set role='admin' where firebase_uid=$1",
    'update public.profiles set is_active=true where firebase_uid=$1',
    'delete from public.profiles where firebase_uid=$1',
    "insert into public.audit_events(actor_uid,action) values($1,'forged')",
  ]) await assert.rejects(asCustomer(alice, db => db.query(sql, [alice])), denied);
  await assert.rejects(asCustomer(alice, db => db.query('update app_private.auth_configuration set integration_enabled=true')), denied);
  await assert.rejects(asCustomer(alice, db => db.query('select * from public.audit_events')), denied);
  await assert.rejects(asCustomer(alice, db => db.query('create function public.fake_admin() returns boolean language sql as $$select true$$')), denied);
  await assert.rejects(asCustomer(alice, db => db.query("insert into public.profiles(firebase_uid,email,role) values('client-created','client@example.invalid','admin')")), denied);
});

test('malformed, oversized, unsupported and over-limit bouquets cannot be written through SQL', async () => {
  const base = defaultDesign();
  const invalidValues = [null, [], {}, { ...base, flowers: null }, { ...base, wrapper: 'Unapproved' }, { ...base, ribbon: 'Fairy Lights' },
    { ...base, messageCard: 'yes' }, { ...base, role: 'admin' }, { ...base, flowers: [{ kind: 'Orchid', color: '#ffffff', count: 1 }] },
    { ...base, flowers: [{ kind: 'Tulip', color: flowerPalette.Rose.Blue, count: 1 }] },
    ...[0, -1, 1.1, '3', null, 31].map(count => ({ ...base, flowers: [{ ...base.flowers[0], count }] })),
    { ...base, flowers: [{ ...base.flowers[0], count: 20 }, { ...base.flowers[1], count: 11 }] },
    { ...base, flowers: [{ ...base.flowers[0], count: 1, price: 1 }] },
    { ...base, extra: 'x'.repeat(16000) },
  ];
  for (const value of invalidValues) {
    await assert.rejects(asCustomer(alice, db => db.query('insert into public.custom_designs(owner_uid,configuration) values($1,$2)', [alice, JSON.stringify(value)])), invalid);
  }
  await assert.rejects(asCustomer(alice, db => db.query('update public.custom_designs set name=$1 where id=$2', [' '.repeat(4), aliceDesign])), invalid);
});

test('SQL options match all 390 confirmed palette/wrapper/ribbon combinations and accept empty previews', async () => {
  let combinations = 0;
  for (const kind of flowerKinds) for (const color of Object.values(flowerPalette[kind])) for (const wrapper of wrappers) for (const ribbon of ribbons) {
    const design = { flowers: [{ kind, color, count: 30 }], wrapper, ribbon, messageCard: true };
    const result = await database.query('select app_private.valid_bouquet($1) as valid', [JSON.stringify(design)]);
    assert.equal(result.rows[0].valid, true);
    combinations++;
  }
  assert.equal(combinations, 390);
  assert.equal((await database.query('select app_private.valid_bouquet($1) as valid', [JSON.stringify({ ...defaultDesign(), flowers: [] })])).rows[0].valid, true);
});

test('client metadata never changes the trusted profile role or ownership', async () => {
  const result = await asCustomer(alice, db => db.query('select firebase_uid,role from public.profiles'), { user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } });
  assert.deepEqual(result.rows, [{ firebase_uid: alice, role: 'customer' }]);
});

test('deactivating a profile immediately blocks its saved designs in the database', async () => {
  await database.query('update public.profiles set is_active=false where firebase_uid=$1', [alice]);
  try { assert.equal((await asCustomer(alice, db => db.query('select id from public.custom_designs'))).rows.length, 0); }
  finally { await database.query('update public.profiles set is_active=true where firebase_uid=$1', [alice]); }
});

test('restrictive policies still prevent cross-user access under an accidental permissive policy', async () => {
  await database.exec('begin');
  try {
    await database.exec('create policy accidental_broad_access on public.custom_designs for all to authenticated using(true) with check(true)');
    await database.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(fixtureClaims(alice))]);
    await database.exec('set local role authenticated');
    assert.deepEqual((await database.query('select id from public.custom_designs')).rows, [{ id: aliceDesign }]);
    assert.equal((await database.query('update public.custom_designs set name=$1 where id=$2 returning id', ['Unauthorized', bobDesign])).rows.length, 0);
  } finally { await database.exec('rollback'); }
});

test('profile write denials survive an accidental extra table grant and permissive policy', async () => {
  await database.exec('begin');
  try {
    await database.exec('grant update on public.profiles to authenticated; create policy accidental_profile_write on public.profiles for update to authenticated using(true) with check(true)');
    await database.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(fixtureClaims(alice))]);
    await database.exec('set local role authenticated');
    const result = await database.query("update public.profiles set role='admin' where firebase_uid=$1 returning firebase_uid", [alice]);
    assert.equal(result.rows.length, 0);
  } finally { await database.exec('rollback'); }
});

test('owner WITH CHECK rejects reassignment even if column grants and a trigger are accidentally weakened', async () => {
  await database.exec('begin');
  try {
    await database.exec('grant update(owner_uid) on public.custom_designs to authenticated; alter table public.custom_designs disable trigger custom_designs_update_metadata');
    await database.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(fixtureClaims(alice))]);
    await database.exec('set local role authenticated');
    await assert.rejects(database.query('update public.custom_designs set owner_uid=$1 where id=$2', [bob, aliceDesign]), denied);
  } finally { await database.exec('rollback'); }
});

test('Customer provisioning is service-only, fixed-role, idempotent and atomically audited', async () => {
  const uid = 'server-provisioned-customer';
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asRole(database, role, fixtureClaims(alice), db => db.query('select * from public.provision_customer_profile($1,$2,$3)', [uid, 'new@example.invalid', fixtureProject])), denied);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await asRole(database, 'service_role', {}, db => db.query('select * from public.provision_customer_profile($1,$2,$3)', [uid, 'new@example.invalid', fixtureProject]));
    assert.deepEqual(result.rows, [{ firebase_uid: uid, role: 'customer', is_active: true }]);
  }
  assert.equal((await database.query("select count(*)::integer as count from public.audit_events where target_id=$1 and action='profile.customer_provisioned'", [uid])).rows[0].count, 1);
});

test('Customer provisioning cannot demote staff/admin or reactivate a disabled profile', async () => {
  for (const uid of ['staff-operations', 'owner-admin', 'disabled-customer']) {
    const before = (await database.query('select role,is_active,email from public.profiles where firebase_uid=$1', [uid])).rows[0];
    await assert.rejects(asRole(database, 'service_role', {}, db => db.query('select * from public.provision_customer_profile($1,$2,$3)', [uid, 'replacement@example.invalid', fixtureProject])), denied);
    const after = (await database.query('select role,is_active,email from public.profiles where firebase_uid=$1', [uid])).rows[0];
    assert.deepEqual(after, before);
  }
});

test('invalid verified-identity arguments cannot create a Customer profile', async () => {
  for (const [uid, email] of [['', 'fixture@example.invalid'], ['x'.repeat(129), 'fixture@example.invalid'], ['invalid-email-customer', 'not-an-email'], [null, 'fixture@example.invalid']]) {
    await assert.rejects(asRole(database, 'service_role', {}, db => db.query('select * from public.provision_customer_profile($1,$2,$3)', [uid, email, fixtureProject])), error => error?.code === '22023');
  }
  assert.equal((await database.query("select firebase_uid from public.profiles where firebase_uid='invalid-email-customer'")).rows.length, 0);
});

test('trusted role/provisioning RPCs are pinned to the enabled database Firebase project', async () => {
  const resolve = project => asRole(database, 'service_role', {}, db => db.query('select * from public.resolve_business_role($1,$2)', [alice, project]));
  assert.deepEqual((await resolve(fixtureProject)).rows, [{ role: 'customer' }]);
  assert.equal((await resolve('wrong-project')).rows.length, 0);
  await assert.rejects(asRole(database, 'service_role', {}, db => db.query('select * from public.provision_customer_profile($1,$2,$3)', ['wrong-project-customer', 'fixture@example.invalid', 'wrong-project'])), denied);
  await assert.rejects(asCustomer(alice, db => db.query('select * from public.resolve_business_role($1,$2)', [bob, fixtureProject])), denied);
  await database.exec('update app_private.auth_configuration set integration_enabled=false');
  try {
    assert.equal((await resolve(fixtureProject)).rows.length, 0);
    await assert.rejects(asRole(database, 'service_role', {}, db => db.query('select * from public.provision_customer_profile($1,$2,$3)', ['disabled-project-customer', 'fixture@example.invalid', fixtureProject])), denied);
  } finally { await database.exec('update app_private.auth_configuration set integration_enabled=true'); }
});

test('failed audit insertion rolls back Customer profile creation', async () => {
  await database.exec('begin');
  try {
    await database.exec('revoke insert on public.audit_events from service_role');
    await database.exec('savepoint before_provision');
    await database.exec('set local role service_role');
    await assert.rejects(database.query('select * from public.provision_customer_profile($1,$2,$3)', ['audit-failure-customer', 'fixture@example.invalid', fixtureProject]), denied);
    await database.exec('rollback to savepoint before_provision');
    assert.equal((await database.query("select firebase_uid from public.profiles where firebase_uid='audit-failure-customer'")).rows.length, 0);
  } finally { await database.exec('rollback'); }
});

test('trusted server role can read profiles and append audit events without public audit access', async () => {
  await asRole(database, 'service_role', {}, async db => {
    assert.equal((await db.query('select firebase_uid from public.profiles where firebase_uid=$1', [bob])).rows.length, 1);
    await db.query('insert into public.audit_events(actor_uid,action,target_id) values($1,$2,$1)', ['owner-admin', 'fixture.audit']);
  });
  assert.equal((await database.query("select count(*)::integer as count from public.audit_events where action='fixture.audit'")).rows[0].count, 1);
});

test('RLS is enabled/forced and no application private helper runs as security definer', async () => {
  const tables = await database.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relname in ('profiles','custom_designs','products','flower_types','audit_events','auth_configuration') and relkind='r'");
  assert.equal(tables.rows.length, 6);
  assert.equal(tables.rows.every(row => row.relrowsecurity && row.relforcerowsecurity), true);
  const functions = await database.query("select proname,prosecdef from pg_proc join pg_namespace on pg_namespace.oid=pronamespace where nspname='app_private'");
  assert.equal(functions.rows.every(row => !row.prosecdef), true);
  const prices = await database.query('select count(*)::integer as count from public.flower_types where price_per_stem_php is not null');
  assert.equal(prices.rows[0].count, 0);
});
